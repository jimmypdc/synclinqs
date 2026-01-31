import {
  ErrorType,
  ErrorSeverity,
  ErrorQueueStatus,
  RetryResult,
} from '@prisma/client';

// ============================================
// Error Queue Item Types
// ============================================

export interface AddToQueueOptions {
  maxRetries?: number;
  initialRetryDelayMs?: number;
  context?: Record<string, unknown>;
}

export interface AddToQueueData {
  errorType: ErrorType;
  severity?: ErrorSeverity;
  sourceSystem?: string;
  destinationSystem?: string;
  recordId?: string;
  recordType?: string;
  errorData: Record<string, unknown>;
  errorMessage: string;
  errorStack?: string;
  errorCode?: string;
}

export interface FormattedErrorItem {
  id: string;
  organizationId: string;
  errorType: ErrorType;
  severity: ErrorSeverity;
  sourceSystem?: string;
  destinationSystem?: string;
  recordId?: string;
  recordType?: string;
  errorData: Record<string, unknown>;
  errorMessage: string;
  errorCode?: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  status: ErrorQueueStatus;
  resolutionNotes?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  context?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListErrorsQuery {
  page: number;
  limit: number;
  status?: ErrorQueueStatus;
  errorType?: ErrorType;
  severity?: ErrorSeverity;
  sourceSystem?: string;
  destinationSystem?: string;
  recordType?: string;
  startDate?: string;
  endDate?: string;
}

// ============================================
// Retry Types
// ============================================

export interface FormattedRetryLog {
  id: string;
  errorQueueId: string;
  retryAttempt: number;
  retryAt: Date;
  retryResult: RetryResult;
  errorMessage?: string;
  responseData?: Record<string, unknown>;
  durationMs?: number;
  createdAt: Date;
}

export interface RetryProcessorFn {
  (errorData: Record<string, unknown>): Promise<unknown>;
}

export interface RetryQueueResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

// ============================================
// Error Statistics Types
// ============================================

export interface ErrorStats {
  total: number;
  byStatus: Record<ErrorQueueStatus, number>;
  byType: Record<ErrorType, number>;
  bySeverity: Record<ErrorSeverity, number>;
  pendingRetries: number;
  failedPermanently: number;
  resolvedToday: number;
  averageRetryCount: number;
  oldestPendingError?: Date;
}

export interface ErrorTrend {
  date: string;
  total: number;
  resolved: number;
  failed: number;
}

export interface ErrorStatsQuery {
  startDate?: Date;
  endDate?: Date;
  groupBy?: 'day' | 'week' | 'month';
}

// ============================================
// Resolution Types
// ============================================

export interface ResolveErrorData {
  notes?: string;
  resolvedBy: string;
}

export interface IgnoreErrorData {
  reason: string;
  ignoredBy: string;
}

export interface BulkRetryResult {
  queued: number;
  failed: number;
  errors: Array<{
    errorId: string;
    message: string;
  }>;
}

// ============================================
// Error Classification
// ============================================

export const RETRYABLE_ERROR_TYPES: ErrorType[] = [
  'NETWORK_ERROR',
  'TIMEOUT_ERROR',
  'RATE_LIMIT_ERROR',
  'API_ERROR',
];

export const PERMANENT_ERROR_TYPES: ErrorType[] = [
  'VALIDATION_ERROR',
  'MAPPING_ERROR',
  'FILE_FORMAT_ERROR',
  'AUTHENTICATION_ERROR',
  'DATA_INTEGRITY_ERROR',
];

export function isRetryableErrorType(errorType: ErrorType): boolean {
  return RETRYABLE_ERROR_TYPES.includes(errorType);
}

export function isPermanentErrorType(errorType: ErrorType): boolean {
  return PERMANENT_ERROR_TYPES.includes(errorType);
}

// ============================================
// Backoff Calculation
// ============================================

export interface BackoffOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterFactor?: number;
}

export const DEFAULT_BACKOFF_OPTIONS: BackoffOptions = {
  baseDelayMs: 60000, // 1 minute
  maxDelayMs: 24 * 60 * 60 * 1000, // 24 hours
  jitterFactor: 0.1, // 10% jitter
};

export function calculateNextRetryTime(
  retryCount: number,
  options: BackoffOptions = DEFAULT_BACKOFF_OPTIONS
): Date {
  const { baseDelayMs = 60000, maxDelayMs = 86400000, jitterFactor = 0.1 } = options;

  // Exponential backoff: 2^retryCount * baseDelay
  const exponentialDelay = Math.pow(2, retryCount) * baseDelayMs;

  // Add jitter to prevent thundering herd
  const jitter = Math.random() * jitterFactor * exponentialDelay;

  // Cap at max delay
  const totalDelay = Math.min(exponentialDelay + jitter, maxDelayMs);

  return new Date(Date.now() + totalDelay);
}

// Re-export Prisma enums for convenience
export {
  ErrorType,
  ErrorSeverity,
  ErrorQueueStatus,
  RetryResult,
};
