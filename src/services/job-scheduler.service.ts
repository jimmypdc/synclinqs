import * as cron from 'node-cron';
import { prisma } from '../lib/prisma.js';
import { createError } from '../api/middleware/errorHandler.js';
import { AuditService } from './audit.service.js';
import { NotificationService } from './notification.service.js';
import { ReconciliationService } from './reconciliation.service.js';
import {
  SyncJobType,
  JobExecutionStatus,
  JobTriggerType,
} from '@prisma/client';
import {
  CreateSyncJobInput,
  UpdateSyncJobInput,
  SyncJobSummary,
  SyncJobDetail,
  JobExecutionSummary,
  ListJobsQuery,
  ListExecutionsQuery,
  JobStats,
  OverallJobStats,
  ManualExecutionInput,
  ExecutionResult,
  ScheduleInfo,
  CronValidation,
  describeCronExpression,
} from '../types/job.types.js';
import { logger } from '../utils/logger.js';

interface ScheduledTask {
  jobId: string;
  task: cron.ScheduledTask;
}

export class JobSchedulerService {
  private auditService = new AuditService();
  private notificationService = new NotificationService();
  private reconciliationService = new ReconciliationService();
  private scheduledTasks = new Map<string, ScheduledTask>();
  private isInitialized = false;

  /**
   * Initialize the scheduler and start all active jobs
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Job scheduler already initialized');
      return;
    }

    logger.info('Initializing job scheduler');

    // Load and schedule all active jobs
    const activeJobs = await prisma.syncJob.findMany({
      where: {
        isActive: true,
        scheduleCron: { not: null },
        deletedAt: null,
      },
    });

    for (const job of activeJobs) {
      if (job.scheduleCron) {
        this.scheduleJob(job.id, job.scheduleCron, job.timezone);
      }
    }

    this.isInitialized = true;
    logger.info('Job scheduler initialized', { scheduledJobs: activeJobs.length });
  }

  /**
   * Shutdown the scheduler
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down job scheduler');

    for (const [jobId, scheduled] of this.scheduledTasks) {
      scheduled.task.stop();
      logger.debug('Stopped scheduled job', { jobId });
    }

    this.scheduledTasks.clear();
    this.isInitialized = false;
    logger.info('Job scheduler shut down');
  }

  // ============================================
  // Job CRUD
  // ============================================

  /**
   * Create a new sync job
   */
  async createJob(
    organizationId: string,
    input: CreateSyncJobInput,
    userId: string
  ): Promise<SyncJobSummary> {
    // Validate cron expression if provided
    if (input.scheduleCron) {
      const validation = this.validateCronExpression(input.scheduleCron);
      if (!validation.isValid) {
        throw createError(validation.errorMessage || 'Invalid cron expression', 400, 'INVALID_CRON');
      }
    }

    const nextRunAt = input.scheduleCron
      ? this.calculateNextRun(input.scheduleCron, input.timezone ?? 'UTC')
      : undefined;

    const job = await prisma.syncJob.create({
      data: {
        organizationId,
        name: input.name,
        description: input.description,
        jobType: input.jobType,
        sourceSystem: input.sourceSystem,
        destinationSystem: input.destinationSystem,
        integrationId: input.integrationId,
        mappingConfigId: input.mappingConfigId,
        scheduleCron: input.scheduleCron,
        timezone: input.timezone ?? 'UTC',
        configuration: input.configuration as object ?? undefined,
        nextRunAt,
        createdBy: userId,
      },
    });

    // Schedule if has cron expression
    if (job.scheduleCron && job.isActive) {
      this.scheduleJob(job.id, job.scheduleCron, job.timezone);
    }

    await this.auditService.log({
      organizationId,
      userId,
      action: 'CREATE_SYNC_JOB',
      entityType: 'SyncJob',
      entityId: job.id,
      newValues: { name: input.name, jobType: input.jobType },
    });

    return this.formatJobSummary(job);
  }

  /**
   * Update a sync job
   */
  async updateJob(
    jobId: string,
    organizationId: string,
    input: UpdateSyncJobInput,
    userId: string
  ): Promise<SyncJobSummary> {
    const existing = await prisma.syncJob.findFirst({
      where: { id: jobId, organizationId, deletedAt: null },
    });

    if (!existing) {
      throw createError('Sync job not found', 404, 'NOT_FOUND');
    }

    // Validate new cron expression if provided
    if (input.scheduleCron) {
      const validation = this.validateCronExpression(input.scheduleCron);
      if (!validation.isValid) {
        throw createError(validation.errorMessage || 'Invalid cron expression', 400, 'INVALID_CRON');
      }
    }

    const newCron = input.scheduleCron ?? existing.scheduleCron;
    const newTimezone = input.timezone ?? existing.timezone;
    const newIsActive = input.isActive ?? existing.isActive;
    const nextRunAt = newCron ? this.calculateNextRun(newCron, newTimezone) : undefined;

    const job = await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        name: input.name,
        description: input.description,
        sourceSystem: input.sourceSystem,
        destinationSystem: input.destinationSystem,
        integrationId: input.integrationId,
        mappingConfigId: input.mappingConfigId,
        scheduleCron: input.scheduleCron,
        timezone: input.timezone,
        isActive: input.isActive,
        configuration: input.configuration as object ?? undefined,
        nextRunAt,
      },
    });

    // Update schedule
    this.unscheduleJob(jobId);
    if (job.scheduleCron && newIsActive) {
      this.scheduleJob(job.id, job.scheduleCron, job.timezone);
    }

    await this.auditService.log({
      organizationId,
      userId,
      action: 'UPDATE_SYNC_JOB',
      entityType: 'SyncJob',
      entityId: job.id,
      oldValues: { name: existing.name, isActive: existing.isActive },
      newValues: { name: input.name, isActive: input.isActive },
    });

    return this.formatJobSummary(job);
  }

  /**
   * Delete a sync job (soft delete)
   */
  async deleteJob(
    jobId: string,
    organizationId: string,
    userId: string
  ): Promise<void> {
    const existing = await prisma.syncJob.findFirst({
      where: { id: jobId, organizationId, deletedAt: null },
    });

    if (!existing) {
      throw createError('Sync job not found', 404, 'NOT_FOUND');
    }

    await prisma.syncJob.update({
      where: { id: jobId },
      data: { deletedAt: new Date(), isActive: false },
    });

    this.unscheduleJob(jobId);

    await this.auditService.log({
      organizationId,
      userId,
      action: 'DELETE_SYNC_JOB',
      entityType: 'SyncJob',
      entityId: jobId,
    });
  }

  /**
   * List sync jobs
   */
  async listJobs(
    organizationId: string,
    query: ListJobsQuery
  ): Promise<{
    data: SyncJobSummary[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where: Record<string, unknown> = { organizationId, deletedAt: null };

    if (query.jobType) where.jobType = query.jobType;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.sourceSystem) where.sourceSystem = query.sourceSystem;
    if (query.destinationSystem) where.destinationSystem = query.destinationSystem;
    if (query.hasSchedule !== undefined) {
      where.scheduleCron = query.hasSchedule ? { not: null } : null;
    }

    const [jobs, total] = await Promise.all([
      prisma.syncJob.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.syncJob.count({ where }),
    ]);

    return {
      data: jobs.map((j) => this.formatJobSummary(j)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * Get job by ID with details
   */
  async getJobById(
    jobId: string,
    organizationId: string
  ): Promise<SyncJobDetail> {
    const job = await prisma.syncJob.findFirst({
      where: { id: jobId, organizationId, deletedAt: null },
      include: {
        integration: { select: { id: true, name: true, type: true, status: true } },
        mappingConfig: {
          select: { id: true, name: true, sourceSystem: true, destinationSystem: true },
        },
        creator: { select: { id: true, firstName: true, lastName: true, email: true } },
        executions: {
          take: 10,
          orderBy: { executionStart: 'desc' },
        },
      },
    });

    if (!job) {
      throw createError('Sync job not found', 404, 'NOT_FOUND');
    }

    const stats = await this.getJobStats(jobId);

    return {
      ...this.formatJobSummary(job),
      integration: job.integration ?? undefined,
      mappingConfig: job.mappingConfig ?? undefined,
      creator: job.creator ?? undefined,
      recentExecutions: job.executions.map((e) => this.formatExecutionSummary(e)),
      stats,
    };
  }

  // ============================================
  // Job Execution
  // ============================================

  /**
   * Manually trigger a job execution
   */
  async executeJob(
    jobId: string,
    organizationId: string,
    userId: string,
    input?: ManualExecutionInput
  ): Promise<ExecutionResult> {
    const job = await prisma.syncJob.findFirst({
      where: { id: jobId, organizationId, deletedAt: null },
    });

    if (!job) {
      throw createError('Sync job not found', 404, 'NOT_FOUND');
    }

    return this.runJobExecution(job, 'MANUAL', userId, input?.dryRun);
  }

  /**
   * List job executions
   */
  async listExecutions(
    jobId: string,
    organizationId: string,
    query: ListExecutionsQuery
  ): Promise<{
    data: JobExecutionSummary[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    // Verify job belongs to organization
    const job = await prisma.syncJob.findFirst({
      where: { id: jobId, organizationId, deletedAt: null },
    });

    if (!job) {
      throw createError('Sync job not found', 404, 'NOT_FOUND');
    }

    const where: Record<string, unknown> = { syncJobId: jobId };

    if (query.status) where.status = query.status;
    if (query.triggeredBy) where.triggeredBy = query.triggeredBy;
    if (query.startDate || query.endDate) {
      where.executionStart = {};
      if (query.startDate)
        (where.executionStart as Record<string, Date>).gte = new Date(query.startDate);
      if (query.endDate)
        (where.executionStart as Record<string, Date>).lte = new Date(query.endDate);
    }

    const [executions, total] = await Promise.all([
      prisma.jobExecution.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { executionStart: 'desc' },
      }),
      prisma.jobExecution.count({ where }),
    ]);

    return {
      data: executions.map((e) => this.formatExecutionSummary(e)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * Get overall job stats
   */
  async getOverallStats(organizationId: string): Promise<OverallJobStats> {
    const [
      totalJobs,
      activeJobs,
      scheduledJobs,
      runningExecutions,
      todayStats,
      byType,
      byStatus,
    ] = await Promise.all([
      prisma.syncJob.count({ where: { organizationId, deletedAt: null } }),
      prisma.syncJob.count({ where: { organizationId, isActive: true, deletedAt: null } }),
      prisma.syncJob.count({
        where: { organizationId, scheduleCron: { not: null }, deletedAt: null },
      }),
      prisma.jobExecution.count({
        where: {
          syncJob: { organizationId },
          status: 'RUNNING',
        },
      }),
      this.getTodayStats(organizationId),
      prisma.syncJob.groupBy({
        by: ['jobType'],
        where: { organizationId, deletedAt: null },
        _count: true,
      }),
      prisma.jobExecution.groupBy({
        by: ['status'],
        where: {
          syncJob: { organizationId },
          executionStart: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        _count: true,
      }),
    ]);

    const byTypeMap: Record<SyncJobType, number> = {
      CONTRIBUTION_SYNC: 0,
      EMPLOYEE_SYNC: 0,
      ELECTION_SYNC: 0,
      RECONCILIATION: 0,
      FILE_EXPORT: 0,
      CLEANUP: 0,
      REPORT_GENERATION: 0,
    };
    for (const item of byType) {
      byTypeMap[item.jobType] = item._count;
    }

    const byStatusMap: Record<JobExecutionStatus, number> = {
      PENDING: 0,
      RUNNING: 0,
      COMPLETED: 0,
      FAILED: 0,
      PARTIAL: 0,
      CANCELLED: 0,
    };
    for (const item of byStatus) {
      byStatusMap[item.status] = item._count;
    }

    return {
      totalJobs,
      activeJobs,
      scheduledJobs,
      runningExecutions,
      completedToday: todayStats.completed,
      failedToday: todayStats.failed,
      averageSuccessRate: todayStats.successRate,
      byType: byTypeMap,
      byStatus: byStatusMap,
    };
  }

  // ============================================
  // Cron Validation
  // ============================================

  /**
   * Validate a cron expression
   */
  validateCronExpression(cronExpression: string): CronValidation {
    try {
      const isValid = cron.validate(cronExpression);
      if (!isValid) {
        return { isValid: false, errorMessage: 'Invalid cron expression format' };
      }

      return {
        isValid: true,
        nextRun: this.calculateNextRun(cronExpression, 'UTC') ?? undefined,
        humanReadable: describeCronExpression(cronExpression),
      };
    } catch {
      return { isValid: false, errorMessage: 'Failed to parse cron expression' };
    }
  }

  /**
   * Get schedule info for a cron expression
   */
  getScheduleInfo(cronExpression: string, timezone: string = 'UTC'): ScheduleInfo | null {
    const validation = this.validateCronExpression(cronExpression);
    if (!validation.isValid) return null;

    const nextRuns: Date[] = [];
    // Calculate next 5 runs
    let currentTime = new Date();
    for (let i = 0; i < 5; i++) {
      const nextRun = this.calculateNextRun(cronExpression, timezone, currentTime);
      if (nextRun) {
        nextRuns.push(nextRun);
        currentTime = new Date(nextRun.getTime() + 60000); // Add 1 minute
      }
    }

    return {
      cron: cronExpression,
      timezone,
      nextRuns,
      isValid: true,
      humanReadable: describeCronExpression(cronExpression),
    };
  }

  // ============================================
  // Private Helpers
  // ============================================

  private scheduleJob(jobId: string, cronExpression: string, timezone: string): void {
    try {
      const task = cron.schedule(
        cronExpression,
        async () => {
          await this.runScheduledJob(jobId);
        },
        { timezone }
      );

      this.scheduledTasks.set(jobId, { jobId, task });
      logger.info('Scheduled job', { jobId, cron: cronExpression, timezone });
    } catch (error) {
      logger.error('Failed to schedule job', {
        jobId,
        cron: cronExpression,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private unscheduleJob(jobId: string): void {
    const scheduled = this.scheduledTasks.get(jobId);
    if (scheduled) {
      scheduled.task.stop();
      this.scheduledTasks.delete(jobId);
      logger.debug('Unscheduled job', { jobId });
    }
  }

  private async runScheduledJob(jobId: string): Promise<void> {
    const job = await prisma.syncJob.findFirst({
      where: { id: jobId, isActive: true, deletedAt: null },
    });

    if (!job) {
      logger.warn('Scheduled job not found or inactive', { jobId });
      this.unscheduleJob(jobId);
      return;
    }

    await this.runJobExecution(job, 'SCHEDULED');
  }

  private async runJobExecution(
    job: {
      id: string;
      organizationId: string;
      name: string;
      jobType: SyncJobType;
      sourceSystem: string | null;
      destinationSystem: string | null;
      configuration: unknown;
    },
    triggeredBy: JobTriggerType,
    triggeredByUserId?: string,
    dryRun?: boolean
  ): Promise<ExecutionResult> {
    const execution = await prisma.jobExecution.create({
      data: {
        syncJobId: job.id,
        triggeredBy,
        triggeredByUserId,
        status: 'RUNNING',
      },
    });

    const startTime = Date.now();
    let result: ExecutionResult;

    try {
      logger.info('Starting job execution', {
        executionId: execution.id,
        jobId: job.id,
        jobType: job.jobType,
        triggeredBy,
      });

      // Execute based on job type
      let records = { processed: 0, successful: 0, failed: 0 };

      switch (job.jobType) {
        case 'RECONCILIATION':
          if (job.sourceSystem && job.destinationSystem) {
            const reconResult = await this.reconciliationService.performReconciliation(
              job.organizationId,
              {
                sourceSystem: job.sourceSystem,
                destinationSystem: job.destinationSystem,
                reconciliationType: 'CONTRIBUTION',
                reconciliationDate: new Date(),
              },
              triggeredByUserId || 'system'
            );
            records = {
              processed: reconResult.totalRecords,
              successful: reconResult.matchedRecords,
              failed: reconResult.unmatchedSourceRecords + reconResult.unmatchedDestinationRecords,
            };
          }
          break;

        case 'CLEANUP':
          records = await this.runCleanupJob(job.organizationId, job.configuration);
          break;

        default:
          // For other job types, would integrate with actual processing logic
          logger.info('Job type execution placeholder', { jobType: job.jobType });
          break;
      }

      const durationMs = Date.now() - startTime;

      // Update execution as completed
      await prisma.jobExecution.update({
        where: { id: execution.id },
        data: {
          status: records.failed > 0 ? 'PARTIAL' : 'COMPLETED',
          executionEnd: new Date(),
          recordsProcessed: records.processed,
          recordsSuccessful: records.successful,
          recordsFailed: records.failed,
          performanceMetrics: {
            durationMs,
            recordsPerSecond: records.processed > 0 ? records.processed / (durationMs / 1000) : 0,
          },
        },
      });

      // Update job's last run time
      await prisma.syncJob.update({
        where: { id: job.id },
        data: {
          lastRunAt: new Date(),
          nextRunAt: job.sourceSystem
            ? this.calculateNextRun(job.sourceSystem, 'UTC')
            : undefined,
        },
      });

      result = {
        executionId: execution.id,
        status: records.failed > 0 ? 'PARTIAL' : 'COMPLETED',
        recordsProcessed: records.processed,
        recordsSuccessful: records.successful,
        recordsFailed: records.failed,
        durationMs,
      };

      // Send success notification
      await this.notificationService.sendNotification(job.organizationId, {
        notificationType: 'JOB_COMPLETED',
        severity: 'SUCCESS',
        title: `Job Completed: ${job.name}`,
        message: `Processed ${records.processed} records (${records.successful} successful, ${records.failed} failed)`,
        actionUrl: `/jobs/${job.id}/executions/${execution.id}`,
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update execution as failed
      await prisma.jobExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          executionEnd: new Date(),
          errorSummary: errorMessage,
          performanceMetrics: { durationMs },
        },
      });

      result = {
        executionId: execution.id,
        status: 'FAILED',
        recordsProcessed: 0,
        recordsSuccessful: 0,
        recordsFailed: 0,
        durationMs,
        errors: [{ message: errorMessage }],
      };

      // Send failure notification
      await this.notificationService.sendNotification(job.organizationId, {
        notificationType: 'JOB_FAILED',
        severity: 'HIGH',
        title: `Job Failed: ${job.name}`,
        message: errorMessage,
        actionUrl: `/jobs/${job.id}/executions/${execution.id}`,
      });

      logger.error('Job execution failed', {
        executionId: execution.id,
        jobId: job.id,
        error: errorMessage,
      });
    }

    return result;
  }

  private async runCleanupJob(
    organizationId: string,
    configuration: unknown
  ): Promise<{ processed: number; successful: number; failed: number }> {
    const config = configuration as { retentionDays?: number } | null;
    const retentionDays = config?.retentionDays ?? 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Clean up old notifications
    const deletedNotifications = await prisma.notification.deleteMany({
      where: {
        organizationId,
        createdAt: { lt: cutoffDate },
        isRead: true,
      },
    });

    // Clean up old execution records
    const deletedExecutions = await prisma.jobExecution.deleteMany({
      where: {
        syncJob: { organizationId },
        executionStart: { lt: cutoffDate },
      },
    });

    const processed = deletedNotifications.count + deletedExecutions.count;

    return {
      processed,
      successful: processed,
      failed: 0,
    };
  }

  private async getJobStats(jobId: string): Promise<JobStats> {
    const [executions, lastSuccess, lastFailure] = await Promise.all([
      prisma.jobExecution.findMany({
        where: { syncJobId: jobId },
        orderBy: { executionStart: 'desc' },
        take: 100,
      }),
      prisma.jobExecution.findFirst({
        where: { syncJobId: jobId, status: 'COMPLETED' },
        orderBy: { executionStart: 'desc' },
      }),
      prisma.jobExecution.findFirst({
        where: { syncJobId: jobId, status: 'FAILED' },
        orderBy: { executionStart: 'desc' },
      }),
    ]);

    const total = executions.length;
    const successful = executions.filter((e) => e.status === 'COMPLETED').length;
    const failed = executions.filter((e) => e.status === 'FAILED').length;
    const totalDuration = executions.reduce((sum, e) => {
      if (e.executionEnd) {
        return sum + (e.executionEnd.getTime() - e.executionStart.getTime());
      }
      return sum;
    }, 0);

    // Count consecutive failures
    let consecutiveFailures = 0;
    for (const exec of executions) {
      if (exec.status === 'FAILED') {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    return {
      totalExecutions: total,
      successfulExecutions: successful,
      failedExecutions: failed,
      successRate: total > 0 ? Math.round((successful / total) * 10000) / 100 : 0,
      averageDurationMs: total > 0 ? Math.round(totalDuration / total) : 0,
      totalRecordsProcessed: executions.reduce((sum, e) => sum + e.recordsProcessed, 0),
      lastExecutionAt: executions[0]?.executionStart,
      lastSuccessAt: lastSuccess?.executionStart,
      lastFailureAt: lastFailure?.executionStart,
      consecutiveFailures,
    };
  }

  private async getTodayStats(
    organizationId: string
  ): Promise<{ completed: number; failed: number; successRate: number }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [completed, failed] = await Promise.all([
      prisma.jobExecution.count({
        where: {
          syncJob: { organizationId },
          status: 'COMPLETED',
          executionStart: { gte: todayStart },
        },
      }),
      prisma.jobExecution.count({
        where: {
          syncJob: { organizationId },
          status: 'FAILED',
          executionStart: { gte: todayStart },
        },
      }),
    ]);

    const total = completed + failed;
    return {
      completed,
      failed,
      successRate: total > 0 ? Math.round((completed / total) * 10000) / 100 : 100,
    };
  }

  private calculateNextRun(
    cronExpression: string,
    timezone: string,
    from?: Date
  ): Date | null {
    // Simple implementation - in production use cron-parser library
    // For now, just return a placeholder date
    const now = from || new Date();
    const next = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    return next;
  }

  private formatJobSummary(job: {
    id: string;
    organizationId: string;
    name: string;
    description: string | null;
    jobType: SyncJobType;
    sourceSystem: string | null;
    destinationSystem: string | null;
    integrationId: string | null;
    mappingConfigId: string | null;
    scheduleCron: string | null;
    timezone: string;
    isActive: boolean;
    lastRunAt: Date | null;
    nextRunAt: Date | null;
    configuration: unknown;
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): SyncJobSummary {
    return {
      id: job.id,
      organizationId: job.organizationId,
      name: job.name,
      description: job.description ?? undefined,
      jobType: job.jobType,
      sourceSystem: job.sourceSystem ?? undefined,
      destinationSystem: job.destinationSystem ?? undefined,
      integrationId: job.integrationId ?? undefined,
      mappingConfigId: job.mappingConfigId ?? undefined,
      scheduleCron: job.scheduleCron ?? undefined,
      timezone: job.timezone,
      isActive: job.isActive,
      lastRunAt: job.lastRunAt ?? undefined,
      nextRunAt: job.nextRunAt ?? undefined,
      configuration: job.configuration as Record<string, unknown> ?? undefined,
      createdBy: job.createdBy ?? undefined,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  private formatExecutionSummary(execution: {
    id: string;
    syncJobId: string;
    executionStart: Date;
    executionEnd: Date | null;
    status: JobExecutionStatus;
    recordsProcessed: number;
    recordsSuccessful: number;
    recordsFailed: number;
    errorSummary: string | null;
    triggeredBy: JobTriggerType;
    triggeredByUserId: string | null;
    createdAt: Date;
  }): JobExecutionSummary {
    return {
      id: execution.id,
      syncJobId: execution.syncJobId,
      executionStart: execution.executionStart,
      executionEnd: execution.executionEnd ?? undefined,
      status: execution.status,
      recordsProcessed: execution.recordsProcessed,
      recordsSuccessful: execution.recordsSuccessful,
      recordsFailed: execution.recordsFailed,
      errorSummary: execution.errorSummary ?? undefined,
      triggeredBy: execution.triggeredBy,
      triggeredByUserId: execution.triggeredByUserId ?? undefined,
      createdAt: execution.createdAt,
    };
  }
}
