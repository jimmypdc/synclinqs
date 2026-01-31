import { ErrorQueueService } from './error-queue.service.js';
import { MappingService } from './mapping.service.js';
import { logger } from '../utils/logger.js';
import {
  FormattedErrorItem,
  RetryQueueResult,
  RetryProcessorFn,
  ErrorType,
} from '../types/error-queue.types.js';

type ErrorProcessor = (error: FormattedErrorItem) => Promise<unknown>;

export class RetryService {
  private errorQueueService: ErrorQueueService;
  private mappingService: MappingService;
  private processors: Map<ErrorType, ErrorProcessor> = new Map();
  private isProcessing = false;

  constructor() {
    this.errorQueueService = new ErrorQueueService();
    this.mappingService = new MappingService();
    this.registerDefaultProcessors();
  }

  /**
   * Register default error processors
   */
  private registerDefaultProcessors(): void {
    // Register processor for mapping errors
    this.registerProcessor('MAPPING_ERROR', async (error) => {
      return this.processMappingError(error);
    });

    // Register processor for API errors
    this.registerProcessor('API_ERROR', async (error) => {
      return this.processApiError(error);
    });

    // Register processor for network errors
    this.registerProcessor('NETWORK_ERROR', async (error) => {
      return this.processNetworkError(error);
    });

    // Register processor for timeout errors
    this.registerProcessor('TIMEOUT_ERROR', async (error) => {
      return this.processTimeoutError(error);
    });

    // Register processor for rate limit errors
    this.registerProcessor('RATE_LIMIT_ERROR', async (error) => {
      return this.processRateLimitError(error);
    });
  }

  /**
   * Register a custom error processor
   */
  registerProcessor(errorType: ErrorType, processor: ErrorProcessor): void {
    this.processors.set(errorType, processor);
  }

  /**
   * Process the retry queue
   */
  async processRetryQueue(limit: number = 50): Promise<RetryQueueResult> {
    if (this.isProcessing) {
      logger.warn('Retry queue processing is already in progress');
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
      };
    }

    this.isProcessing = true;
    const result: RetryQueueResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    };

    try {
      const readyErrors = await this.errorQueueService.getReadyForRetry(limit);

      for (const error of readyErrors) {
        result.processed++;

        try {
          const success = await this.processError(error);
          if (success) {
            result.succeeded++;
          } else {
            result.failed++;
          }
        } catch (err) {
          logger.error('Error processing retry', {
            errorId: error.id,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
          result.failed++;
        }
      }

      return result;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single error
   */
  async processError(error: FormattedErrorItem): Promise<boolean> {
    const startTime = Date.now();

    // Mark as retrying
    await this.errorQueueService.markAsRetrying(error.id);

    const processor = this.processors.get(error.errorType);

    if (!processor) {
      logger.warn(`No processor registered for error type: ${error.errorType}`);
      await this.errorQueueService.recordRetryResult(
        error.id,
        false,
        `No processor registered for error type: ${error.errorType}`,
        undefined,
        Date.now() - startTime
      );
      return false;
    }

    try {
      const result = await processor(error);
      const durationMs = Date.now() - startTime;

      await this.errorQueueService.recordRetryResult(
        error.id,
        true,
        undefined,
        { result },
        durationMs
      );

      logger.info('Error retry succeeded', {
        errorId: error.id,
        errorType: error.errorType,
        retryCount: error.retryCount + 1,
        durationMs,
      });

      return true;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      await this.errorQueueService.recordRetryResult(
        error.id,
        false,
        errorMessage,
        undefined,
        durationMs
      );

      logger.warn('Error retry failed', {
        errorId: error.id,
        errorType: error.errorType,
        retryCount: error.retryCount + 1,
        error: errorMessage,
        durationMs,
      });

      return false;
    }
  }

  /**
   * Process mapping errors
   */
  private async processMappingError(error: FormattedErrorItem): Promise<unknown> {
    const { mappingConfigId, sourceData } = error.errorData as {
      mappingConfigId?: string;
      sourceData?: Record<string, unknown>[];
    };

    if (!mappingConfigId || !sourceData) {
      throw new Error('Missing mappingConfigId or sourceData in error data');
    }

    // Retry the mapping operation
    const result = await this.mappingService.applyMapping(
      mappingConfigId,
      sourceData,
      error.organizationId
    );

    if (result.metrics.failedRecords > 0) {
      throw new Error(`Mapping still has ${result.metrics.failedRecords} failed records`);
    }

    return result;
  }

  /**
   * Process API errors
   */
  private async processApiError(error: FormattedErrorItem): Promise<unknown> {
    const { endpoint, method, payload, originalResponse } = error.errorData as {
      endpoint?: string;
      method?: string;
      payload?: unknown;
      originalResponse?: unknown;
    };

    // This is a placeholder - actual implementation would depend on the API being called
    // In production, this would call the appropriate integration service
    logger.info('Retrying API call', {
      errorId: error.id,
      endpoint,
      method,
    });

    // Simulated retry - in production this would make the actual API call
    throw new Error('API retry not implemented - requires integration service');
  }

  /**
   * Process network errors
   */
  private async processNetworkError(error: FormattedErrorItem): Promise<unknown> {
    // Similar to API errors - would depend on what operation failed
    const { operation, params } = error.errorData as {
      operation?: string;
      params?: unknown;
    };

    logger.info('Retrying network operation', {
      errorId: error.id,
      operation,
    });

    throw new Error('Network retry not implemented - requires integration service');
  }

  /**
   * Process timeout errors
   */
  private async processTimeoutError(error: FormattedErrorItem): Promise<unknown> {
    // Timeout errors are typically retried the same way as network errors
    return this.processNetworkError(error);
  }

  /**
   * Process rate limit errors
   */
  private async processRateLimitError(error: FormattedErrorItem): Promise<unknown> {
    // Rate limit errors should have a longer delay before retry
    // The exponential backoff in the error queue handles this
    return this.processApiError(error);
  }

  /**
   * Create a reusable retry wrapper for any async operation
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      baseDelayMs?: number;
      maxDelayMs?: number;
      onRetry?: (attempt: number, error: Error) => void;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelayMs = 1000,
      maxDelayMs = 30000,
      onRetry,
    } = options;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < maxRetries) {
          const delay = Math.min(
            Math.pow(2, attempt) * baseDelayMs + Math.random() * 100,
            maxDelayMs
          );

          onRetry?.(attempt + 1, lastError);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Check if an error is transient (safe to retry)
   */
  isTransientError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('timeout') ||
        message.includes('econnrefused') ||
        message.includes('etimedout') ||
        message.includes('network') ||
        message.includes('rate limit') ||
        message.includes('too many requests') ||
        message.includes('503') ||
        message.includes('502') ||
        message.includes('504')
      );
    }
    return false;
  }
}

// Export singleton instance
export const retryService = new RetryService();
