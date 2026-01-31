import { Job } from 'bullmq';
import { RetryJobData, RetryJobResult } from '../types.js';
import { RetryService } from '../../services/retry.service.js';
import { ErrorQueueService } from '../../services/error-queue.service.js';
import { logger } from '../../utils/logger.js';

const retryService = new RetryService();
const errorQueueService = new ErrorQueueService();

export async function processRetryJob(
  job: Job<RetryJobData, RetryJobResult>
): Promise<RetryJobResult> {
  const { errorId, organizationId, errorType, retryAttempt } = job.data;

  logger.info('Processing retry job', {
    jobId: job.id,
    errorId,
    organizationId,
    errorType,
    retryAttempt,
  });

  try {
    // Get the error item
    const errorItem = await errorQueueService.getById(errorId, organizationId);

    // Process the error using the retry service
    const success = await retryService.processError(errorItem);

    logger.info('Retry job completed', {
      jobId: job.id,
      errorId,
      success,
    });

    return {
      success,
      errorId,
      completedAt: new Date().toISOString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Retry job failed', {
      jobId: job.id,
      errorId,
      error: errorMessage,
    });

    return {
      success: false,
      errorId,
      errorMessage,
      completedAt: new Date().toISOString(),
    };
  }
}
