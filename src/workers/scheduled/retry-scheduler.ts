import * as cron from 'node-cron';
import { Queue } from 'bullmq';
import { getRedisConnection } from '../connection.js';
import { RetryJobData, RetryJobResult, RETRY_QUEUE_CONFIG } from '../types.js';
import { ErrorQueueService } from '../../services/error-queue.service.js';
import { logger } from '../../utils/logger.js';

let scheduledTask: cron.ScheduledTask | null = null;
let retryQueue: Queue<RetryJobData, RetryJobResult> | null = null;
const errorQueueService = new ErrorQueueService();

/**
 * Initialize the retry queue
 */
function getRetryQueue(): Queue<RetryJobData, RetryJobResult> {
  if (!retryQueue) {
    retryQueue = new Queue<RetryJobData, RetryJobResult>(
      RETRY_QUEUE_CONFIG.name,
      {
        connection: getRedisConnection(),
        defaultJobOptions: {
          removeOnComplete: {
            age: 60 * 60, // Keep completed jobs for 1 hour
            count: 500,
          },
          removeOnFail: {
            age: 24 * 60 * 60, // Keep failed jobs for 24 hours
            count: 1000,
          },
        },
      }
    );
    logger.info('Retry queue initialized');
  }
  return retryQueue;
}

/**
 * Queue errors that are ready for retry
 */
async function queueReadyRetries(): Promise<void> {
  logger.debug('Checking for errors ready to retry');

  try {
    // Get errors that are ready for retry
    const readyErrors = await errorQueueService.getReadyForRetry(50);

    if (readyErrors.length === 0) {
      logger.debug('No errors ready for retry');
      return;
    }

    const queue = getRetryQueue();
    let queued = 0;

    for (const error of readyErrors) {
      try {
        // Create a unique job ID to prevent duplicates
        const jobId = `retry-${error.id}-${error.retryCount + 1}`;

        const jobData: RetryJobData = {
          errorId: error.id,
          organizationId: error.organizationId,
          errorType: error.errorType,
          retryAttempt: error.retryCount + 1,
        };

        await queue.add('retry', jobData, {
          jobId,
          priority: error.severity === 'CRITICAL' ? 1 : (error.severity === 'ERROR' ? 2 : 3),
        });

        queued++;
      } catch (err) {
        // Job may already exist (duplicate), ignore
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (!message.includes('Job is locked')) {
          logger.warn('Failed to queue retry', {
            errorId: error.id,
            error: message,
          });
        }
      }
    }

    if (queued > 0) {
      logger.info('Queued retries', { count: queued, total: readyErrors.length });
    }
  } catch (error) {
    logger.error('Error in retry scheduler', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Start the retry scheduler
 * Runs every minute to check for errors ready to retry
 */
export function startRetryScheduler(): void {
  if (scheduledTask) {
    logger.warn('Retry scheduler already running');
    return;
  }

  // Run every minute
  scheduledTask = cron.schedule('* * * * *', () => {
    queueReadyRetries().catch((err) => {
      logger.error('Unhandled error in retry scheduler', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    });
  });

  logger.info('Retry scheduler started (runs every minute)');

  // Run immediately on startup
  queueReadyRetries().catch((err) => {
    logger.error('Error on initial retry queue check', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  });
}

/**
 * Stop the retry scheduler
 */
export function stopRetryScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    logger.info('Retry scheduler stopped');
  }
}

/**
 * Close the retry queue
 */
export async function closeRetryQueue(): Promise<void> {
  if (retryQueue) {
    await retryQueue.close();
    retryQueue = null;
    logger.info('Retry queue closed');
  }
}

/**
 * Get queue statistics
 */
export async function getRetryQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> {
  const queue = getRetryQueue();
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}
