import { Worker } from 'bullmq';
import { getRedisConnection, closeRedisConnection } from './connection.js';
import { closeAllQueues } from './queues.js';
import { processJob, getProcessor } from './processors/index.js';
import { processRetryJob } from './processors/retry.processor.js';
import {
  startRetryScheduler,
  stopRetryScheduler,
  closeRetryQueue,
} from './scheduled/retry-scheduler.js';
import {
  SyncJobData,
  SyncJobResult,
  RetryJobData,
  RetryJobResult,
  IntegrationType,
  QUEUE_CONFIGS,
  RETRY_QUEUE_CONFIG,
  QueueName,
} from './types.js';
import { logger } from '../utils/logger.js';
import { JobSchedulerService } from '../services/job-scheduler.service.js';

const workers = new Map<QueueName, Worker<SyncJobData, SyncJobResult>>();
let retryWorker: Worker<RetryJobData, RetryJobResult> | null = null;
let isShuttingDown = false;
let jobSchedulerService: JobSchedulerService | null = null;

export async function startWorkers(): Promise<void> {
  logger.info('Starting workers');

  let connection;
  try {
    connection = getRedisConnection();
    logger.info('Redis connection obtained');
  } catch (err) {
    const error = err as Error;
    logger.error('Failed to get Redis connection', { error: error.message, stack: error.stack });
    throw err;
  }

  for (const [integrationType, config] of Object.entries(QUEUE_CONFIGS)) {
    const type = integrationType as IntegrationType;
    const processor = getProcessor(type);

    logger.info('Creating worker', { queueName: config.name, integrationType });

    let worker: Worker<SyncJobData, SyncJobResult>;
    try {
      worker = new Worker<SyncJobData, SyncJobResult>(
        config.name,
        async (job) => processJob(job, processor),
        {
          connection,
          concurrency: config.concurrency,
          lockDuration: config.timeoutMs,
          stalledInterval: Math.floor(config.timeoutMs / 2),
        }
      );
    } catch (err) {
      console.error('Worker creation error:', err);
      const error = err as Error;
      logger.error('Failed to create worker', { queueName: config.name, errorMsg: String(err), errorName: error.name });
      throw err;
    }

    worker.on('completed', (job, result) => {
      logger.info('Job completed', {
        jobId: job.id,
        queueName: config.name,
        integrationId: result.integrationId,
        recordsProcessed: result.recordsProcessed,
      });
    });

    worker.on('failed', (job, error) => {
      logger.error('Job failed', {
        jobId: job?.id,
        queueName: config.name,
        error: error.message,
        attempt: job?.attemptsMade,
      });
    });

    worker.on('error', (error) => {
      logger.error('Worker error', {
        queueName: config.name,
        error: error.message,
      });
    });

    worker.on('stalled', (jobId) => {
      logger.warn('Job stalled', {
        jobId,
        queueName: config.name,
      });
    });

    // Wait for worker to be ready
    await worker.waitUntilReady();

    workers.set(config.name, worker);
    logger.info('Worker started', {
      queueName: config.name,
      concurrency: config.concurrency,
      timeoutMs: config.timeoutMs,
    });
  }

  // Start retry worker
  try {
    retryWorker = new Worker<RetryJobData, RetryJobResult>(
      RETRY_QUEUE_CONFIG.name,
      processRetryJob,
      {
        connection,
        concurrency: RETRY_QUEUE_CONFIG.concurrency,
        lockDuration: RETRY_QUEUE_CONFIG.timeoutMs,
        stalledInterval: Math.floor(RETRY_QUEUE_CONFIG.timeoutMs / 2),
      }
    );

    retryWorker.on('completed', (job, result) => {
      logger.info('Retry job completed', {
        jobId: job.id,
        errorId: result.errorId,
        success: result.success,
      });
    });

    retryWorker.on('failed', (job, error) => {
      logger.error('Retry job failed', {
        jobId: job?.id,
        error: error.message,
      });
    });

    retryWorker.on('error', (error) => {
      logger.error('Retry worker error', {
        error: error.message,
      });
    });

    await retryWorker.waitUntilReady();
    logger.info('Retry worker started', {
      queueName: RETRY_QUEUE_CONFIG.name,
      concurrency: RETRY_QUEUE_CONFIG.concurrency,
    });
  } catch (err) {
    const error = err as Error;
    logger.error('Failed to create retry worker', { error: error.message });
    throw err;
  }

  // Start retry scheduler
  startRetryScheduler();

  // Start job scheduler (Phase 3)
  try {
    jobSchedulerService = new JobSchedulerService();
    await jobSchedulerService.initialize();
    logger.info('Job scheduler initialized');
  } catch (err) {
    const error = err as Error;
    logger.error('Failed to initialize job scheduler', { error: error.message });
    // Non-fatal - continue without job scheduler
  }

  logger.info('All workers started', { count: workers.size + 1 });
}

export async function stopWorkers(): Promise<void> {
  if (isShuttingDown) {
    logger.warn('Workers already shutting down');
    return;
  }

  isShuttingDown = true;
  logger.info('Stopping workers');

  // Stop job scheduler (Phase 3)
  if (jobSchedulerService) {
    try {
      await jobSchedulerService.shutdown();
      jobSchedulerService = null;
      logger.info('Job scheduler stopped');
    } catch (error) {
      logger.error('Error stopping job scheduler', { error });
    }
  }

  // Stop retry scheduler first
  stopRetryScheduler();

  // Close all sync workers
  const closeWorkerPromises = Array.from(workers.values()).map(async (worker) => {
    try {
      await worker.close();
    } catch (error) {
      logger.error('Error closing worker', { error });
    }
  });

  await Promise.all(closeWorkerPromises);
  workers.clear();

  // Close retry worker
  if (retryWorker) {
    try {
      await retryWorker.close();
      retryWorker = null;
      logger.info('Retry worker stopped');
    } catch (error) {
      logger.error('Error closing retry worker', { error });
    }
  }

  logger.info('All workers stopped');

  // Close queues
  await closeAllQueues();

  // Close retry queue
  await closeRetryQueue();

  // Close Redis connection
  await closeRedisConnection();

  isShuttingDown = false;
}

export function getWorkerCount(): number {
  return workers.size;
}

export function isRunning(): boolean {
  return workers.size > 0 && !isShuttingDown;
}

// Standalone worker main function
export async function main(): Promise<void> {
  logger.info('Worker process starting', {
    nodeEnv: process.env.NODE_ENV,
    pid: process.pid,
  });

  // Handle graceful shutdown
  const handleShutdown = async (signal: string) => {
    logger.info('Received shutdown signal', { signal });
    await stopWorkers();
    process.exit(0);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception in worker process', { error: error.message, stack: error.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection in worker process', { reason });
    process.exit(1);
  });

  try {
    await startWorkers();
    logger.info('Worker process ready');
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
}
