import {
  SyncJobType,
  JobExecutionStatus,
  JobTriggerType,
} from '@prisma/client';

// ============================================
// Sync Job Types
// ============================================

export interface CreateSyncJobInput {
  name: string;
  description?: string;
  jobType: SyncJobType;
  sourceSystem?: string;
  destinationSystem?: string;
  integrationId?: string;
  mappingConfigId?: string;
  scheduleCron?: string;
  timezone?: string;
  configuration?: JobConfiguration;
}

export interface UpdateSyncJobInput {
  name?: string;
  description?: string;
  sourceSystem?: string;
  destinationSystem?: string;
  integrationId?: string | null;
  mappingConfigId?: string | null;
  scheduleCron?: string | null;
  timezone?: string;
  isActive?: boolean;
  configuration?: JobConfiguration;
}

export interface SyncJobSummary {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  jobType: SyncJobType;
  sourceSystem?: string;
  destinationSystem?: string;
  integrationId?: string;
  mappingConfigId?: string;
  scheduleCron?: string;
  timezone: string;
  isActive: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  configuration?: JobConfiguration;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncJobDetail extends SyncJobSummary {
  integration?: {
    id: string;
    name: string;
    type: string;
    status: string;
  };
  mappingConfig?: {
    id: string;
    name: string;
    sourceSystem: string;
    destinationSystem: string;
  };
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  recentExecutions: JobExecutionSummary[];
  stats: JobStats;
}

// ============================================
// Job Configuration Types
// ============================================

export interface JobConfiguration {
  // Common settings
  batchSize?: number;
  timeout?: number; // milliseconds
  retryOnFailure?: boolean;
  maxRetries?: number;

  // Sync-specific settings
  syncDirection?: 'pull' | 'push' | 'bidirectional';
  incrementalSync?: boolean;
  lastSyncCheckpoint?: string;

  // Reconciliation-specific settings
  toleranceSettings?: {
    amountToleranceCents?: number;
    percentageTolerance?: number;
    dateTolerance?: number;
  };

  // File export settings
  exportFormat?: 'csv' | 'excel' | 'json' | 'xml';
  exportDestination?: string;
  includeHeaders?: boolean;

  // Cleanup settings
  retentionDays?: number;
  cleanupTypes?: string[];

  // Custom parameters
  customParams?: Record<string, unknown>;
}

// ============================================
// Job Execution Types
// ============================================

export interface JobExecutionSummary {
  id: string;
  syncJobId: string;
  executionStart: Date;
  executionEnd?: Date;
  status: JobExecutionStatus;
  recordsProcessed: number;
  recordsSuccessful: number;
  recordsFailed: number;
  errorSummary?: string;
  triggeredBy: JobTriggerType;
  triggeredByUserId?: string;
  createdAt: Date;
}

export interface JobExecutionDetail extends JobExecutionSummary {
  errorDetails?: JobErrorDetails;
  performanceMetrics?: PerformanceMetrics;
  syncJob: SyncJobSummary;
  triggeredByUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface JobErrorDetails {
  errors: Array<{
    recordId?: string;
    field?: string;
    message: string;
    code?: string;
  }>;
  firstErrorAt?: Date;
  lastErrorAt?: Date;
  errorTypes: Record<string, number>;
}

export interface PerformanceMetrics {
  durationMs: number;
  recordsPerSecond: number;
  memoryUsageMB?: number;
  cpuUsagePercent?: number;
  networkBytesIn?: number;
  networkBytesOut?: number;
  databaseQueriesCount?: number;
  averageQueryTimeMs?: number;
}

// ============================================
// Job Query Types
// ============================================

export interface ListJobsQuery {
  page: number;
  limit: number;
  jobType?: SyncJobType;
  isActive?: boolean;
  sourceSystem?: string;
  destinationSystem?: string;
  hasSchedule?: boolean;
}

export interface ListExecutionsQuery {
  page: number;
  limit: number;
  status?: JobExecutionStatus;
  triggeredBy?: JobTriggerType;
  startDate?: string;
  endDate?: string;
}

// ============================================
// Job Stats Types
// ============================================

export interface JobStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  averageDurationMs: number;
  totalRecordsProcessed: number;
  lastExecutionAt?: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  consecutiveFailures: number;
}

export interface OverallJobStats {
  totalJobs: number;
  activeJobs: number;
  scheduledJobs: number;
  runningExecutions: number;
  completedToday: number;
  failedToday: number;
  averageSuccessRate: number;
  byType: Record<SyncJobType, number>;
  byStatus: Record<JobExecutionStatus, number>;
}

export interface JobTrend {
  date: string;
  executions: number;
  successful: number;
  failed: number;
  averageDurationMs: number;
}

// ============================================
// Manual Execution Types
// ============================================

export interface ManualExecutionInput {
  configuration?: Partial<JobConfiguration>;
  dryRun?: boolean;
}

export interface ExecutionResult {
  executionId: string;
  status: JobExecutionStatus;
  recordsProcessed: number;
  recordsSuccessful: number;
  recordsFailed: number;
  durationMs: number;
  errors?: Array<{
    message: string;
    recordId?: string;
  }>;
}

// ============================================
// Scheduling Types
// ============================================

export interface ScheduleInfo {
  cron: string;
  timezone: string;
  nextRuns: Date[];
  isValid: boolean;
  humanReadable: string;
}

export interface CronValidation {
  isValid: boolean;
  errorMessage?: string;
  nextRun?: Date;
  humanReadable?: string;
}

// ============================================
// Job Type Display Names
// ============================================

export const JOB_TYPE_DISPLAY: Record<SyncJobType, string> = {
  CONTRIBUTION_SYNC: 'Contribution Sync',
  EMPLOYEE_SYNC: 'Employee Sync',
  ELECTION_SYNC: 'Election Sync',
  RECONCILIATION: 'Reconciliation',
  FILE_EXPORT: 'File Export',
  CLEANUP: 'Cleanup',
  REPORT_GENERATION: 'Report Generation',
};

export const JOB_STATUS_DISPLAY: Record<JobExecutionStatus, string> = {
  PENDING: 'Pending',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  PARTIAL: 'Partial',
  CANCELLED: 'Cancelled',
};

export const TRIGGER_TYPE_DISPLAY: Record<JobTriggerType, string> = {
  SCHEDULED: 'Scheduled',
  MANUAL: 'Manual',
  API: 'API',
  WEBHOOK: 'Webhook',
  SYSTEM: 'System',
};

// ============================================
// Helper Functions
// ============================================

export function getJobTypeDisplay(jobType: SyncJobType): string {
  return JOB_TYPE_DISPLAY[jobType];
}

export function getStatusDisplay(status: JobExecutionStatus): string {
  return JOB_STATUS_DISPLAY[status];
}

export function getTriggerTypeDisplay(triggerType: JobTriggerType): string {
  return TRIGGER_TYPE_DISPLAY[triggerType];
}

export function isJobRunning(status: JobExecutionStatus): boolean {
  return status === 'RUNNING' || status === 'PENDING';
}

export function isJobComplete(status: JobExecutionStatus): boolean {
  return status === 'COMPLETED' || status === 'FAILED' || status === 'PARTIAL' || status === 'CANCELLED';
}

export function isJobSuccessful(status: JobExecutionStatus): boolean {
  return status === 'COMPLETED';
}

export function calculateSuccessRate(successful: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((successful / total) * 10000) / 100; // 2 decimal places
}

export function parseCronExpression(cron: string): ScheduleInfo | null {
  // Basic validation - a full cron parser would be more complex
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) {
    return null;
  }

  // This is a simplified version - in production, use a library like cron-parser
  return {
    cron,
    timezone: 'UTC',
    nextRuns: [],
    isValid: true,
    humanReadable: describeCronExpression(cron),
  };
}

export function describeCronExpression(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) {
    return 'Invalid cron expression';
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Common patterns
  if (minute === '0' && hour === '0' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Daily at midnight';
  }
  if (minute === '0' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every hour';
  }
  if (minute === '*' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every minute';
  }
  if (minute === '*/5' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every 5 minutes';
  }
  if (minute === '*/15' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every 15 minutes';
  }
  if (minute === '0' && hour === '9' && dayOfMonth === '*' && month === '*' && dayOfWeek === '1-5') {
    return 'Weekdays at 9:00 AM';
  }

  return `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
}

export function calculateNextRunTime(cron: string, timezone: string = 'UTC'): Date | null {
  // In production, use a library like cron-parser
  // This is a placeholder that returns null
  return null;
}

// Re-export Prisma enums for convenience
export {
  SyncJobType,
  JobExecutionStatus,
  JobTriggerType,
};
