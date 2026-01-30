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

export type QueueName = 'sync-sftp' | 'sync-rest-api' | 'sync-soap' | 'sync-webhook';

export interface QueueConfig {
  name: QueueName;
  concurrency: number;
  timeoutMs: number;
  maxRetries: number;
  backoffBaseMs: number;
}

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
