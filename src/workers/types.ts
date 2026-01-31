import { Job } from 'bullmq';

export type IntegrationType = 'SFTP' | 'REST_API' | 'SOAP' | 'WEBHOOK';

export interface SyncJobData {
  integrationId: string;
  organizationId: string;
  integrationType: IntegrationType;
  triggeredBy: string;
  triggeredAt: string;
  idempotencyKey: string;
}

export interface SyncJobResult {
  success: boolean;
  integrationId: string;
  recordsProcessed?: number;
  errorMessage?: string;
  completedAt: string;
}

export type SyncJob = Job<SyncJobData, SyncJobResult>;

export interface IntegrationConfig {
  // Common fields
  [key: string]: unknown;
}

export interface SftpConfig extends IntegrationConfig {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  remotePath?: string;
  localPath?: string;
  archiveProcessed?: boolean;
  archivePath?: string;
  ackPath?: string;
}

export interface RestApiConfig extends IntegrationConfig {
  baseUrl: string;
  authType: 'bearer' | 'basic' | 'api_key' | 'oauth2';
  apiKey?: string;
  apiKeyHeader?: string;
  username?: string;
  password?: string;
  accessToken?: string;
  // OAuth2 settings
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  scope?: string;
  // Request settings
  headers?: Record<string, string>;
  timeout?: number;
  pageSize?: number;
  rateLimitMs?: number;
  paginationParams?: Record<string, string>;
  // Endpoints
  endpoints?: Array<{
    path: string;
    method?: string;
    params?: Record<string, string>;
  }>;
  pushEndpoint?: string;
}

export interface SoapConfig extends IntegrationConfig {
  wsdlUrl: string;
  endpoint?: string;
  username?: string;
  password?: string;
  securityType?: 'WSSecurity' | 'BasicAuth';
  passwordType?: 'PasswordText' | 'PasswordDigest';
  hasTimestamp?: boolean;
  hasNonce?: boolean;
  soapHeaders?: Array<Record<string, unknown>>;
  timeout?: number;
  stopOnError?: boolean;
  operations?: Array<{
    name: string;
    params?: Record<string, unknown>;
  }>;
}

export interface WebhookConfig extends IntegrationConfig {
  webhookUrl: string;
  secret?: string;
  headers?: Record<string, string>;
  authHeader?: string;
  authValue?: string;
  timeout?: number;
  retryOnFailure?: boolean;
  batchSize?: number;
  events?: string[];
}

export type QueueName =
  | 'sync-sftp'
  | 'sync-rest-api'
  | 'sync-soap'
  | 'sync-webhook'
  | 'error-retry'
  | 'scheduled-jobs'
  | 'reconciliation'
  | 'notifications'
  | 'webhook-delivery';

export interface QueueConfig {
  name: QueueName;
  concurrency: number;
  timeoutMs: number;
  maxRetries: number;
  backoffBaseMs: number;
}

// Retry queue types
export interface RetryJobData {
  errorId: string;
  organizationId: string;
  errorType: string;
  retryAttempt: number;
}

export interface RetryJobResult {
  success: boolean;
  errorId: string;
  errorMessage?: string;
  completedAt: string;
}

export const RETRY_QUEUE_CONFIG: QueueConfig = {
  name: 'error-retry',
  concurrency: 5,
  timeoutMs: 5 * 60 * 1000, // 5 minutes
  maxRetries: 0, // We handle retries in the error queue service
  backoffBaseMs: 0,
};

export const QUEUE_CONFIGS: Record<IntegrationType, QueueConfig> = {
  SFTP: {
    name: 'sync-sftp',
    concurrency: 2,
    timeoutMs: 30 * 60 * 1000, // 30 minutes
    maxRetries: 3,
    backoffBaseMs: 60 * 1000, // 60 seconds
  },
  REST_API: {
    name: 'sync-rest-api',
    concurrency: 10,
    timeoutMs: 5 * 60 * 1000, // 5 minutes
    maxRetries: 5,
    backoffBaseMs: 5 * 1000, // 5 seconds
  },
  SOAP: {
    name: 'sync-soap',
    concurrency: 3,
    timeoutMs: 10 * 60 * 1000, // 10 minutes
    maxRetries: 4,
    backoffBaseMs: 30 * 1000, // 30 seconds
  },
  WEBHOOK: {
    name: 'sync-webhook',
    concurrency: 5,
    timeoutMs: 1 * 60 * 1000, // 1 minute
    maxRetries: 2,
    backoffBaseMs: 10 * 1000, // 10 seconds
  },
};

export function getQueueNameForType(type: IntegrationType): QueueName {
  return QUEUE_CONFIGS[type].name;
}

// ============================================
// Phase 3: Scheduled Jobs Queue Types
// ============================================

export interface ScheduledJobData {
  syncJobId: string;
  organizationId: string;
  jobType: string;
  triggeredBy: 'SCHEDULED' | 'MANUAL' | 'API' | 'WEBHOOK' | 'SYSTEM';
  triggeredByUserId?: string;
}

export interface ScheduledJobResult {
  success: boolean;
  syncJobId: string;
  recordsProcessed: number;
  recordsSuccessful: number;
  recordsFailed: number;
  errorMessage?: string;
  completedAt: string;
}

export const SCHEDULED_JOBS_QUEUE_CONFIG: QueueConfig = {
  name: 'scheduled-jobs',
  concurrency: 5,
  timeoutMs: 30 * 60 * 1000, // 30 minutes
  maxRetries: 2,
  backoffBaseMs: 60 * 1000, // 60 seconds
};

// ============================================
// Phase 3: Reconciliation Queue Types
// ============================================

export interface ReconciliationJobData {
  organizationId: string;
  sourceSystem: string;
  destinationSystem: string;
  reconciliationType: string;
  reconciliationDate: string;
  triggeredBy: string;
}

export interface ReconciliationJobResult {
  success: boolean;
  reportId: string;
  totalRecords: number;
  matchedRecords: number;
  discrepancies: number;
  completedAt: string;
}

export const RECONCILIATION_QUEUE_CONFIG: QueueConfig = {
  name: 'reconciliation',
  concurrency: 2,
  timeoutMs: 60 * 60 * 1000, // 60 minutes
  maxRetries: 1,
  backoffBaseMs: 5 * 60 * 1000, // 5 minutes
};

// ============================================
// Phase 3: Notification Queue Types
// ============================================

export interface NotificationJobData {
  organizationId: string;
  userId?: string;
  notificationType: string;
  severity: string;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  channels: string[];
}

export interface NotificationJobResult {
  success: boolean;
  notificationId: string;
  channelResults: Record<string, boolean>;
  completedAt: string;
}

export const NOTIFICATION_QUEUE_CONFIG: QueueConfig = {
  name: 'notifications',
  concurrency: 10,
  timeoutMs: 1 * 60 * 1000, // 1 minute
  maxRetries: 3,
  backoffBaseMs: 5 * 1000, // 5 seconds
};

// ============================================
// Phase 3: Webhook Delivery Queue Types
// ============================================

export interface WebhookDeliveryJobData {
  deliveryId: string;
  organizationId: string;
  webhookUrl: string;
  payload: Record<string, unknown>;
  retryAttempt: number;
}

export interface WebhookDeliveryJobResult {
  success: boolean;
  deliveryId: string;
  httpStatus?: number;
  errorMessage?: string;
  completedAt: string;
}

export const WEBHOOK_DELIVERY_QUEUE_CONFIG: QueueConfig = {
  name: 'webhook-delivery',
  concurrency: 10,
  timeoutMs: 30 * 1000, // 30 seconds
  maxRetries: 5,
  backoffBaseMs: 10 * 1000, // 10 seconds
};
