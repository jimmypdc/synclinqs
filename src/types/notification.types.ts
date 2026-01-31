import {
  NotificationType,
  NotificationSeverity,
  NotificationChannel,
  AlertRuleType,
} from '@prisma/client';

// ============================================
// Notification Types
// ============================================

export interface CreateNotificationInput {
  userId?: string;
  notificationType: NotificationType;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationSummary {
  id: string;
  organizationId: string;
  userId?: string;
  notificationType: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

export interface NotificationDetail extends NotificationSummary {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

// ============================================
// Notification Query Types
// ============================================

export interface ListNotificationsQuery {
  page: number;
  limit: number;
  isRead?: boolean;
  notificationType?: NotificationType;
  severity?: NotificationSeverity;
  startDate?: string;
  endDate?: string;
}

export interface UnreadCount {
  total: number;
  bySeverity: Record<NotificationSeverity, number>;
}

// ============================================
// Notification Preference Types
// ============================================

export interface NotificationPreferenceSummary {
  id: string;
  userId: string;
  channel: NotificationChannel;
  notificationType: NotificationType;
  isEnabled: boolean;
  settings?: NotificationChannelSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationChannelSettings {
  // Email settings
  emailAddress?: string;

  // Slack settings
  slackChannelId?: string;
  slackChannelName?: string;

  // Webhook settings
  webhookUrl?: string;
  webhookHeaders?: Record<string, string>;

  // General settings
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string;
  timezone?: string;
}

export interface UpdatePreferencesInput {
  preferences: Array<{
    channel: NotificationChannel;
    notificationType: NotificationType;
    isEnabled: boolean;
    settings?: NotificationChannelSettings;
  }>;
}

export interface PreferenceMatrix {
  userId: string;
  preferences: Record<NotificationType, Record<NotificationChannel, boolean>>;
}

// ============================================
// Alert Rule Types
// ============================================

export interface CreateAlertRuleInput {
  name: string;
  description?: string;
  ruleType: AlertRuleType;
  condition: AlertCondition;
  severity?: NotificationSeverity;
  recipients: string[]; // User IDs
  channels: NotificationChannel[];
  cooldownMinutes?: number;
}

export interface UpdateAlertRuleInput {
  name?: string;
  description?: string;
  condition?: AlertCondition;
  severity?: NotificationSeverity;
  recipients?: string[];
  channels?: NotificationChannel[];
  isActive?: boolean;
  cooldownMinutes?: number;
}

export interface AlertRuleSummary {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  ruleType: AlertRuleType;
  condition: AlertCondition;
  severity: NotificationSeverity;
  recipients: string[];
  channels: NotificationChannel[];
  isActive: boolean;
  cooldownMinutes: number;
  lastTriggeredAt?: Date;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertRuleDetail extends AlertRuleSummary {
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  recipientUsers?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }>;
}

// ============================================
// Alert Condition Types
// ============================================

export type AlertOperator = 'greater_than' | 'less_than' | 'equals' | 'not_equals' | 'greater_or_equal' | 'less_or_equal';

export interface AlertCondition {
  metric: string;
  operator: AlertOperator;
  threshold: number;
  timeWindowMinutes?: number;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
}

export interface ErrorRateCondition extends AlertCondition {
  metric: 'error_percentage' | 'error_count';
  errorTypes?: string[];
}

export interface ReconciliationVarianceCondition extends AlertCondition {
  metric: 'variance_amount' | 'variance_percentage' | 'unmatched_count';
  sourceSystem?: string;
  destinationSystem?: string;
}

export interface SyncFailureCondition extends AlertCondition {
  metric: 'consecutive_failures' | 'failure_count';
  integrationId?: string;
}

export interface QueueDepthCondition extends AlertCondition {
  metric: 'queue_depth' | 'oldest_message_age_minutes';
  queueName?: string;
}

// ============================================
// Webhook Delivery Types
// ============================================

export interface WebhookDeliverySummary {
  id: string;
  organizationId: string;
  webhookUrl: string;
  notificationId?: string;
  payload: Record<string, unknown>;
  httpStatus?: number;
  responseBody?: string;
  errorMessage?: string;
  deliveredAt?: Date;
  retryCount: number;
  nextRetryAt?: Date;
  createdAt: Date;
}

export interface WebhookPayload {
  event: NotificationType;
  timestamp: string;
  organizationId: string;
  data: Record<string, unknown>;
  signature?: string;
}

export interface WebhookDeliveryResult {
  success: boolean;
  httpStatus?: number;
  errorMessage?: string;
  retryScheduled?: boolean;
  nextRetryAt?: Date;
}

// ============================================
// Notification Sending Types
// ============================================

export interface SendNotificationOptions {
  skipInApp?: boolean;
  skipEmail?: boolean;
  skipSlack?: boolean;
  skipWebhook?: boolean;
  forceChannels?: NotificationChannel[];
}

export interface NotificationDeliveryResult {
  notificationId: string;
  channels: {
    inApp: boolean;
    email: boolean;
    slack: boolean;
    webhook: boolean;
  };
  errors: Array<{
    channel: NotificationChannel;
    message: string;
  }>;
}

// ============================================
// Email Template Types
// ============================================

export interface EmailTemplateData {
  recipientName: string;
  notificationType: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
}

export interface SlackMessageData {
  channel: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  actionUrl?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
}

// ============================================
// Severity Configuration
// ============================================

export const SEVERITY_COLORS: Record<NotificationSeverity, string> = {
  CRITICAL: '#dc2626', // red-600
  HIGH: '#ea580c', // orange-600
  MEDIUM: '#ca8a04', // yellow-600
  LOW: '#2563eb', // blue-600
  INFO: '#6b7280', // gray-500
  SUCCESS: '#16a34a', // green-600
};

export const SEVERITY_PRIORITY: Record<NotificationSeverity, number> = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
  INFO: 5,
  SUCCESS: 6,
};

// ============================================
// Helper Functions
// ============================================

export function getSeverityColor(severity: NotificationSeverity): string {
  return SEVERITY_COLORS[severity];
}

export function compareSeverity(a: NotificationSeverity, b: NotificationSeverity): number {
  return SEVERITY_PRIORITY[a] - SEVERITY_PRIORITY[b];
}

export function getNotificationTypeDisplay(type: NotificationType): string {
  const displayMap: Record<NotificationType, string> = {
    SYNC_COMPLETED: 'Sync Completed',
    SYNC_FAILED: 'Sync Failed',
    RECONCILIATION_COMPLETED: 'Reconciliation Completed',
    RECONCILIATION_DISCREPANCIES: 'Reconciliation Discrepancies',
    ERROR_THRESHOLD_EXCEEDED: 'Error Threshold Exceeded',
    JOB_COMPLETED: 'Job Completed',
    JOB_FAILED: 'Job Failed',
    FILE_UPLOAD_COMPLETED: 'File Upload Completed',
    FILE_UPLOAD_FAILED: 'File Upload Failed',
    CONTRIBUTION_VALIDATION_ERROR: 'Contribution Validation Error',
    SYSTEM_ALERT: 'System Alert',
    USER_INVITATION: 'User Invitation',
  };
  return displayMap[type];
}

export function getChannelDisplay(channel: NotificationChannel): string {
  const displayMap: Record<NotificationChannel, string> = {
    IN_APP: 'In-App',
    EMAIL: 'Email',
    SLACK: 'Slack',
    WEBHOOK: 'Webhook',
  };
  return displayMap[channel];
}

export function shouldSendToChannel(
  notificationType: NotificationType,
  severity: NotificationSeverity,
  channel: NotificationChannel
): boolean {
  // Critical notifications always go to all channels
  if (severity === 'CRITICAL') {
    return true;
  }

  // Default channel rules
  const defaultChannels: Record<NotificationSeverity, NotificationChannel[]> = {
    CRITICAL: ['IN_APP', 'EMAIL', 'SLACK', 'WEBHOOK'],
    HIGH: ['IN_APP', 'EMAIL', 'SLACK'],
    MEDIUM: ['IN_APP', 'EMAIL'],
    LOW: ['IN_APP'],
    INFO: ['IN_APP'],
    SUCCESS: ['IN_APP'],
  };

  return defaultChannels[severity].includes(channel);
}

// Re-export Prisma enums for convenience
export {
  NotificationType,
  NotificationSeverity,
  NotificationChannel,
  AlertRuleType,
};
