import { Worker } from 'bullmq';
import { getRedisConnection, closeRedisConnection } from './connection.js';
import { closeAllQueues } from './queues.js';
import { processJob, getProcessor } from './processors/index.js';
import { SyncJobData, SyncJobResult, IntegrationType, QUEUE_CONFIGS, QueueName } from './types.js';
import { logger } from '../utils/logger.js';

const workers = new Map<QueueName, Worker<SyncJobData, SyncJobResult>>();
let isShuttingDown = false;

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

  logger.info('All workers started', { count: workers.size });
}

export async function stopWorkers(): Promise<void> {
  if (isShuttingDown) {
    logger.warn('Workers already shutting down');
    return;
  }

  isShuttingDown = true;
  logger.info('Stopping workers');

  // Close all workers first
  const closeWorkerPromises = Array.from(workers.values()).map(async (worker) => {
    try {
      await worker.close();
    } catch (error) {
      logger.error('Error closing worker', { error });
    }
  });

  await Promise.all(closeWorkerPromises);
  workers.clear();
  logger.info('All workers stopped');

  // Close queues
  await closeAllQueues();

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
