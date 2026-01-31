import { prisma } from '../lib/prisma.js';
import { createError } from '../api/middleware/errorHandler.js';
import { ErrorType, ErrorSeverity, ErrorQueueStatus, Prisma } from '@prisma/client';
import { AuditService } from './audit.service.js';
import {
  AddToQueueData,
  AddToQueueOptions,
  FormattedErrorItem,
  ListErrorsQuery,
  FormattedRetryLog,
  ErrorStats,
  ResolveErrorData,
  IgnoreErrorData,
  BulkRetryResult,
  calculateNextRetryTime,
  isRetryableErrorType,
  isPermanentErrorType,
} from '../types/error-queue.types.js';

const DEFAULT_MAX_RETRIES = 5;

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class ErrorQueueService {
  private auditService = new AuditService();

  /**
   * Add an error to the queue
   */
  async addToQueue(
    organizationId: string,
    data: AddToQueueData,
    options: AddToQueueOptions = {}
  ): Promise<FormattedErrorItem> {
    const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    const severity = data.severity ?? 'ERROR';

    // Determine if this error is retryable
    const canRetry = isRetryableErrorType(data.errorType);
    const status: ErrorQueueStatus = canRetry ? 'PENDING' : 'MANUAL_REVIEW';
    const nextRetryAt = canRetry ? calculateNextRetryTime(0, {
      baseDelayMs: options.initialRetryDelayMs,
    }) : null;

    const errorItem = await prisma.errorQueueItem.create({
      data: {
        organizationId,
        errorType: data.errorType,
        severity,
        sourceSystem: data.sourceSystem,
        destinationSystem: data.destinationSystem,
        recordId: data.recordId,
        recordType: data.recordType,
        errorData: data.errorData as Prisma.InputJsonValue,
        errorMessage: data.errorMessage,
        errorStack: data.errorStack,
        errorCode: data.errorCode,
        retryCount: 0,
        maxRetries,
        nextRetryAt,
        status,
        context: (options.context ?? null) as Prisma.InputJsonValue,
      },
    });

    return this.formatErrorItem(errorItem);
  }

  /**
   * List errors with filtering and pagination
   */
  async list(
    organizationId: string,
    query: ListErrorsQuery
  ): Promise<{ data: FormattedErrorItem[]; pagination: Pagination }> {
    const where: Prisma.ErrorQueueItemWhereInput = {
      organizationId,
    };

    if (query.status) where.status = query.status;
    if (query.errorType) where.errorType = query.errorType;
    if (query.severity) where.severity = query.severity;
    if (query.sourceSystem) where.sourceSystem = query.sourceSystem;
    if (query.destinationSystem) where.destinationSystem = query.destinationSystem;
    if (query.recordType) where.recordType = query.recordType;

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [items, total] = await Promise.all([
      prisma.errorQueueItem.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.errorQueueItem.count({ where }),
    ]);

    return {
      data: items.map((item) => this.formatErrorItem(item)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * Get a single error by ID
   */
  async getById(id: string, organizationId: string): Promise<FormattedErrorItem> {
    const item = await prisma.errorQueueItem.findFirst({
      where: { id, organizationId },
    });

    if (!item) {
      throw createError('Error not found', 404, 'NOT_FOUND');
    }

    return this.formatErrorItem(item);
  }

  /**
   * Get retry logs for an error
   */
  async getRetryLogs(errorId: string, organizationId: string): Promise<FormattedRetryLog[]> {
    // Verify error belongs to organization
    const error = await prisma.errorQueueItem.findFirst({
      where: { id: errorId, organizationId },
    });

    if (!error) {
      throw createError('Error not found', 404, 'NOT_FOUND');
    }

    const logs = await prisma.retryLog.findMany({
      where: { errorQueueId: errorId },
      orderBy: { retryAttempt: 'desc' },
    });

    return logs.map((log) => this.formatRetryLog(log));
  }

  /**
   * Trigger a manual retry for an error
   */
  async triggerRetry(
    errorId: string,
    organizationId: string,
    userId: string
  ): Promise<FormattedErrorItem> {
    const item = await prisma.errorQueueItem.findFirst({
      where: { id: errorId, organizationId },
    });

    if (!item) {
      throw createError('Error not found', 404, 'NOT_FOUND');
    }

    if (item.status === 'RESOLVED') {
      throw createError('Cannot retry a resolved error', 400, 'INVALID_STATE');
    }

    if (item.status === 'RETRYING') {
      throw createError('Error is already being retried', 400, 'INVALID_STATE');
    }

    // Set status to pending and reset next retry time
    const updated = await prisma.errorQueueItem.update({
      where: { id: errorId },
      data: {
        status: 'PENDING',
        nextRetryAt: new Date(), // Immediate retry
      },
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entityType: 'ErrorQueueItem',
      entityId: errorId,
      oldValues: { status: item.status },
      newValues: { status: 'PENDING', triggeredManualRetry: true },
    });

    return this.formatErrorItem(updated);
  }

  /**
   * Mark error as resolved
   */
  async resolve(
    errorId: string,
    organizationId: string,
    data: ResolveErrorData
  ): Promise<FormattedErrorItem> {
    const item = await prisma.errorQueueItem.findFirst({
      where: { id: errorId, organizationId },
    });

    if (!item) {
      throw createError('Error not found', 404, 'NOT_FOUND');
    }

    if (item.status === 'RESOLVED') {
      throw createError('Error is already resolved', 400, 'INVALID_STATE');
    }

    const updated = await prisma.errorQueueItem.update({
      where: { id: errorId },
      data: {
        status: 'RESOLVED',
        resolutionNotes: data.notes,
        resolvedBy: data.resolvedBy,
        resolvedAt: new Date(),
      },
    });

    await this.auditService.log({
      userId: data.resolvedBy,
      action: 'UPDATE',
      entityType: 'ErrorQueueItem',
      entityId: errorId,
      oldValues: { status: item.status },
      newValues: { status: 'RESOLVED', notes: data.notes },
    });

    return this.formatErrorItem(updated);
  }

  /**
   * Mark error as ignored
   */
  async ignore(
    errorId: string,
    organizationId: string,
    data: IgnoreErrorData
  ): Promise<FormattedErrorItem> {
    const item = await prisma.errorQueueItem.findFirst({
      where: { id: errorId, organizationId },
    });

    if (!item) {
      throw createError('Error not found', 404, 'NOT_FOUND');
    }

    const updated = await prisma.errorQueueItem.update({
      where: { id: errorId },
      data: {
        status: 'IGNORED',
        resolutionNotes: data.reason,
        resolvedBy: data.ignoredBy,
        resolvedAt: new Date(),
      },
    });

    await this.auditService.log({
      userId: data.ignoredBy,
      action: 'UPDATE',
      entityType: 'ErrorQueueItem',
      entityId: errorId,
      oldValues: { status: item.status },
      newValues: { status: 'IGNORED', reason: data.reason },
    });

    return this.formatErrorItem(updated);
  }

  /**
   * Bulk retry errors
   */
  async bulkRetry(
    organizationId: string,
    errorIds: string[],
    userId: string
  ): Promise<BulkRetryResult> {
    const result: BulkRetryResult = {
      queued: 0,
      failed: 0,
      errors: [],
    };

    for (const errorId of errorIds) {
      try {
        await this.triggerRetry(errorId, organizationId, userId);
        result.queued++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          errorId,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Get error statistics
   */
  async getStats(organizationId: string): Promise<ErrorStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      total,
      byStatus,
      byType,
      bySeverity,
      pendingRetries,
      failedPermanently,
      resolvedToday,
      avgRetryCount,
      oldestPending,
    ] = await Promise.all([
      // Total count
      prisma.errorQueueItem.count({ where: { organizationId } }),

      // By status
      prisma.errorQueueItem.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: true,
      }),

      // By type
      prisma.errorQueueItem.groupBy({
        by: ['errorType'],
        where: { organizationId },
        _count: true,
      }),

      // By severity
      prisma.errorQueueItem.groupBy({
        by: ['severity'],
        where: { organizationId },
        _count: true,
      }),

      // Pending retries
      prisma.errorQueueItem.count({
        where: {
          organizationId,
          status: 'PENDING',
          nextRetryAt: { lte: new Date() },
        },
      }),

      // Failed permanently
      prisma.errorQueueItem.count({
        where: { organizationId, status: 'FAILED_PERMANENTLY' },
      }),

      // Resolved today
      prisma.errorQueueItem.count({
        where: {
          organizationId,
          status: 'RESOLVED',
          resolvedAt: { gte: today },
        },
      }),

      // Average retry count
      prisma.errorQueueItem.aggregate({
        where: { organizationId },
        _avg: { retryCount: true },
      }),

      // Oldest pending error
      prisma.errorQueueItem.findFirst({
        where: { organizationId, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    // Transform grouped results to Record
    const statusRecord = Object.fromEntries(
      Object.values(ErrorQueueStatus).map((s) => [s, 0])
    ) as Record<ErrorQueueStatus, number>;
    for (const item of byStatus) {
      statusRecord[item.status] = item._count;
    }

    const typeRecord = Object.fromEntries(
      Object.values(ErrorType).map((t) => [t, 0])
    ) as Record<ErrorType, number>;
    for (const item of byType) {
      typeRecord[item.errorType] = item._count;
    }

    const severityRecord = Object.fromEntries(
      Object.values(ErrorSeverity).map((s) => [s, 0])
    ) as Record<ErrorSeverity, number>;
    for (const item of bySeverity) {
      severityRecord[item.severity] = item._count;
    }

    return {
      total,
      byStatus: statusRecord,
      byType: typeRecord,
      bySeverity: severityRecord,
      pendingRetries,
      failedPermanently,
      resolvedToday,
      averageRetryCount: avgRetryCount._avg.retryCount ?? 0,
      oldestPendingError: oldestPending?.createdAt,
    };
  }

  /**
   * Get errors that are ready for retry
   */
  async getReadyForRetry(limit: number = 100): Promise<FormattedErrorItem[]> {
    const items = await prisma.errorQueueItem.findMany({
      where: {
        status: 'PENDING',
        nextRetryAt: { lte: new Date() },
        retryCount: { lt: prisma.errorQueueItem.fields.maxRetries },
      },
      take: limit,
      orderBy: [{ severity: 'desc' }, { nextRetryAt: 'asc' }],
    });

    return items.map((item) => this.formatErrorItem(item));
  }

  /**
   * Update error status for retry processing
   */
  async markAsRetrying(errorId: string): Promise<void> {
    await prisma.errorQueueItem.update({
      where: { id: errorId },
      data: { status: 'RETRYING' },
    });
  }

  /**
   * Record a retry attempt result
   */
  async recordRetryResult(
    errorId: string,
    success: boolean,
    error?: string,
    responseData?: Record<string, unknown>,
    durationMs?: number
  ): Promise<FormattedErrorItem> {
    const item = await prisma.errorQueueItem.findUnique({
      where: { id: errorId },
    });

    if (!item) {
      throw createError('Error not found', 404, 'NOT_FOUND');
    }

    const retryAttempt = item.retryCount + 1;

    // Create retry log
    await prisma.retryLog.create({
      data: {
        errorQueueId: errorId,
        retryAttempt,
        retryAt: new Date(),
        retryResult: success ? 'SUCCESS' : (this.isTransientError(error) ? 'TRANSIENT_ERROR' : 'FAILED'),
        errorMessage: error,
        responseData: responseData as Prisma.InputJsonValue | undefined,
        durationMs,
      },
    });

    let newStatus: ErrorQueueStatus;
    let nextRetryAt: Date | null = null;

    if (success) {
      newStatus = 'RESOLVED';
    } else if (retryAttempt >= item.maxRetries) {
      newStatus = 'FAILED_PERMANENTLY';
    } else {
      newStatus = 'PENDING';
      nextRetryAt = calculateNextRetryTime(retryAttempt);
    }

    const updated = await prisma.errorQueueItem.update({
      where: { id: errorId },
      data: {
        status: newStatus,
        retryCount: retryAttempt,
        nextRetryAt,
        resolvedAt: success ? new Date() : undefined,
      },
    });

    return this.formatErrorItem(updated);
  }

  /**
   * Check if an error message indicates a transient error
   */
  private isTransientError(error?: string): boolean {
    if (!error) return false;
    const transientPatterns = [
      /timeout/i,
      /connection refused/i,
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
      /network/i,
      /rate limit/i,
      /too many requests/i,
      /503/,
      /502/,
      /504/,
    ];
    return transientPatterns.some((pattern) => pattern.test(error));
  }

  /**
   * Format error item for response
   */
  private formatErrorItem(item: {
    id: string;
    organizationId: string;
    errorType: ErrorType;
    severity: ErrorSeverity;
    sourceSystem: string | null;
    destinationSystem: string | null;
    recordId: string | null;
    recordType: string | null;
    errorData: unknown;
    errorMessage: string;
    errorCode: string | null;
    retryCount: number;
    maxRetries: number;
    nextRetryAt: Date | null;
    status: ErrorQueueStatus;
    resolutionNotes: string | null;
    resolvedBy: string | null;
    resolvedAt: Date | null;
    context: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): FormattedErrorItem {
    return {
      id: item.id,
      organizationId: item.organizationId,
      errorType: item.errorType,
      severity: item.severity,
      sourceSystem: item.sourceSystem ?? undefined,
      destinationSystem: item.destinationSystem ?? undefined,
      recordId: item.recordId ?? undefined,
      recordType: item.recordType ?? undefined,
      errorData: item.errorData as Record<string, unknown>,
      errorMessage: item.errorMessage,
      errorCode: item.errorCode ?? undefined,
      retryCount: item.retryCount,
      maxRetries: item.maxRetries,
      nextRetryAt: item.nextRetryAt ?? undefined,
      status: item.status,
      resolutionNotes: item.resolutionNotes ?? undefined,
      resolvedBy: item.resolvedBy ?? undefined,
      resolvedAt: item.resolvedAt ?? undefined,
      context: item.context as Record<string, unknown> | undefined,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  /**
   * Format retry log for response
   */
  private formatRetryLog(log: {
    id: string;
    errorQueueId: string;
    retryAttempt: number;
    retryAt: Date;
    retryResult: string;
    errorMessage: string | null;
    responseData: unknown;
    durationMs: number | null;
    createdAt: Date;
  }): FormattedRetryLog {
    return {
      id: log.id,
      errorQueueId: log.errorQueueId,
      retryAttempt: log.retryAttempt,
      retryAt: log.retryAt,
      retryResult: log.retryResult as FormattedRetryLog['retryResult'],
      errorMessage: log.errorMessage ?? undefined,
      responseData: log.responseData as Record<string, unknown> | undefined,
      durationMs: log.durationMs ?? undefined,
      createdAt: log.createdAt,
    };
  }
}
