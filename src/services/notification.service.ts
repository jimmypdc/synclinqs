import { prisma } from '../lib/prisma.js';
import { createError } from '../api/middleware/errorHandler.js';
import { EmailService } from './email.service.js';
import { AuditService } from './audit.service.js';
import {
  NotificationType,
  NotificationSeverity,
  NotificationChannel,
  AlertRuleType,
} from '@prisma/client';
import {
  CreateNotificationInput,
  NotificationSummary,
  ListNotificationsQuery,
  UnreadCount,
  NotificationPreferenceSummary,
  UpdatePreferencesInput,
  CreateAlertRuleInput,
  UpdateAlertRuleInput,
  AlertRuleSummary,
  AlertCondition,
  WebhookPayload,
  WebhookDeliveryResult,
  NotificationDeliveryResult,
  SendNotificationOptions,
  SEVERITY_COLORS,
  shouldSendToChannel,
} from '../types/notification.types.js';
import { logger } from '../utils/logger.js';

export class NotificationService {
  private emailService = new EmailService();
  private auditService = new AuditService();

  // ============================================
  // Notification CRUD
  // ============================================

  /**
   * Send a notification through configured channels
   */
  async sendNotification(
    organizationId: string,
    input: CreateNotificationInput,
    options: SendNotificationOptions = {}
  ): Promise<NotificationDeliveryResult> {
    const result: NotificationDeliveryResult = {
      notificationId: '',
      channels: {
        inApp: false,
        email: false,
        slack: false,
        webhook: false,
      },
      errors: [],
    };

    // Create in-app notification
    if (!options.skipInApp) {
      try {
        const notification = await prisma.notification.create({
          data: {
            organizationId,
            userId: input.userId,
            notificationType: input.notificationType,
            severity: input.severity ?? 'INFO',
            title: input.title,
            message: input.message,
            actionUrl: input.actionUrl,
            metadata: input.metadata as object ?? undefined,
          },
        });
        result.notificationId = notification.id;
        result.channels.inApp = true;
      } catch (error) {
        result.errors.push({
          channel: 'IN_APP',
          message: error instanceof Error ? error.message : 'Failed to create notification',
        });
      }
    }

    // Get user preferences if userId provided
    let preferences: Map<NotificationChannel, boolean> = new Map();
    if (input.userId) {
      const userPrefs = await prisma.notificationPreference.findMany({
        where: {
          userId: input.userId,
          notificationType: input.notificationType,
        },
      });
      for (const pref of userPrefs) {
        preferences.set(pref.channel, pref.isEnabled);
      }
    }

    const severity = input.severity ?? 'INFO';

    // Send email if enabled
    if (
      !options.skipEmail &&
      (options.forceChannels?.includes('EMAIL') ||
        preferences.get('EMAIL') !== false &&
        shouldSendToChannel(input.notificationType, severity, 'EMAIL'))
    ) {
      try {
        if (input.userId) {
          const user = await prisma.user.findUnique({
            where: { id: input.userId },
            select: { email: true, firstName: true },
          });
          if (user) {
            const sent = await this.sendNotificationEmail({
              recipientEmail: user.email,
              recipientName: user.firstName,
              notificationType: input.notificationType,
              severity,
              title: input.title,
              message: input.message,
              actionUrl: input.actionUrl,
            });
            result.channels.email = sent;
          }
        }
      } catch (error) {
        result.errors.push({
          channel: 'EMAIL',
          message: error instanceof Error ? error.message : 'Failed to send email',
        });
      }
    }

    // Send webhook if enabled
    if (
      !options.skipWebhook &&
      (options.forceChannels?.includes('WEBHOOK') ||
        preferences.get('WEBHOOK') !== false &&
        shouldSendToChannel(input.notificationType, severity, 'WEBHOOK'))
    ) {
      const webhookResult = await this.sendToOrganizationWebhooks(
        organizationId,
        input.notificationType,
        {
          event: input.notificationType,
          timestamp: new Date().toISOString(),
          organizationId,
          data: {
            title: input.title,
            message: input.message,
            severity,
            metadata: input.metadata,
          },
        },
        result.notificationId || undefined
      );
      result.channels.webhook = webhookResult.some((r) => r.success);
    }

    logger.info('Notification sent', {
      notificationId: result.notificationId,
      type: input.notificationType,
      channels: result.channels,
      errorCount: result.errors.length,
    });

    return result;
  }

  /**
   * List notifications for a user
   */
  async listNotifications(
    organizationId: string,
    userId: string,
    query: ListNotificationsQuery
  ): Promise<{
    data: NotificationSummary[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where: Record<string, unknown> = {
      organizationId,
      OR: [{ userId }, { userId: null }],
    };

    if (query.isRead !== undefined) where.isRead = query.isRead;
    if (query.notificationType) where.notificationType = query.notificationType;
    if (query.severity) where.severity = query.severity;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate)
        (where.createdAt as Record<string, Date>).gte = new Date(query.startDate);
      if (query.endDate) (where.createdAt as Record<string, Date>).lte = new Date(query.endDate);
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      data: notifications.map((n) => this.formatNotification(n)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(organizationId: string, userId: string): Promise<UnreadCount> {
    const unread = await prisma.notification.findMany({
      where: {
        organizationId,
        OR: [{ userId }, { userId: null }],
        isRead: false,
      },
      select: { severity: true },
    });

    const bySeverity: Record<NotificationSeverity, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFO: 0,
      SUCCESS: 0,
    };

    for (const n of unread) {
      bySeverity[n.severity]++;
    }

    return {
      total: unread.length,
      bySeverity,
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(
    notificationId: string,
    organizationId: string,
    userId: string
  ): Promise<NotificationSummary> {
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        organizationId,
        OR: [{ userId }, { userId: null }],
      },
    });

    if (!notification) {
      throw createError('Notification not found', 404, 'NOT_FOUND');
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });

    return this.formatNotification(updated);
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(organizationId: string, userId: string): Promise<{ updated: number }> {
    const result = await prisma.notification.updateMany({
      where: {
        organizationId,
        OR: [{ userId }, { userId: null }],
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });

    return { updated: result.count };
  }

  // ============================================
  // Notification Preferences
  // ============================================

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferenceSummary[]> {
    const preferences = await prisma.notificationPreference.findMany({
      where: { userId },
      orderBy: [{ notificationType: 'asc' }, { channel: 'asc' }],
    });

    return preferences.map((p) => ({
      id: p.id,
      userId: p.userId,
      channel: p.channel,
      notificationType: p.notificationType,
      isEnabled: p.isEnabled,
      settings: (p.settings as Record<string, unknown>) ?? undefined,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    input: UpdatePreferencesInput
  ): Promise<NotificationPreferenceSummary[]> {
    // Upsert each preference
    for (const pref of input.preferences) {
      await prisma.notificationPreference.upsert({
        where: {
          userId_channel_notificationType: {
            userId,
            channel: pref.channel,
            notificationType: pref.notificationType,
          },
        },
        create: {
          userId,
          channel: pref.channel,
          notificationType: pref.notificationType,
          isEnabled: pref.isEnabled,
          settings: pref.settings as object ?? undefined,
        },
        update: {
          isEnabled: pref.isEnabled,
          settings: pref.settings as object ?? undefined,
        },
      });
    }

    return this.getPreferences(userId);
  }

  // ============================================
  // Alert Rules
  // ============================================

  /**
   * List alert rules for organization
   */
  async listAlertRules(organizationId: string): Promise<AlertRuleSummary[]> {
    const rules = await prisma.alertRule.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return rules.map((r) => this.formatAlertRule(r));
  }

  /**
   * Create alert rule
   */
  async createAlertRule(
    organizationId: string,
    input: CreateAlertRuleInput,
    userId: string
  ): Promise<AlertRuleSummary> {
    const rule = await prisma.alertRule.create({
      data: {
        organizationId,
        name: input.name,
        description: input.description,
        ruleType: input.ruleType,
        condition: input.condition as object,
        severity: input.severity ?? 'MEDIUM',
        recipients: input.recipients,
        channels: input.channels,
        cooldownMinutes: input.cooldownMinutes ?? 60,
        createdBy: userId,
      },
    });

    await this.auditService.log({
      organizationId,
      userId,
      action: 'CREATE_ALERT_RULE',
      entityType: 'AlertRule',
      entityId: rule.id,
      newValues: { name: input.name, ruleType: input.ruleType },
    });

    return this.formatAlertRule(rule);
  }

  /**
   * Update alert rule
   */
  async updateAlertRule(
    ruleId: string,
    organizationId: string,
    input: UpdateAlertRuleInput,
    userId: string
  ): Promise<AlertRuleSummary> {
    const existing = await prisma.alertRule.findFirst({
      where: { id: ruleId, organizationId },
    });

    if (!existing) {
      throw createError('Alert rule not found', 404, 'NOT_FOUND');
    }

    const rule = await prisma.alertRule.update({
      where: { id: ruleId },
      data: {
        name: input.name,
        description: input.description,
        condition: input.condition as object | undefined,
        severity: input.severity,
        recipients: input.recipients,
        channels: input.channels,
        isActive: input.isActive,
        cooldownMinutes: input.cooldownMinutes,
      },
    });

    await this.auditService.log({
      organizationId,
      userId,
      action: 'UPDATE_ALERT_RULE',
      entityType: 'AlertRule',
      entityId: rule.id,
      oldValues: { name: existing.name, isActive: existing.isActive },
      newValues: { name: input.name, isActive: input.isActive },
    });

    return this.formatAlertRule(rule);
  }

  /**
   * Delete alert rule
   */
  async deleteAlertRule(
    ruleId: string,
    organizationId: string,
    userId: string
  ): Promise<void> {
    const existing = await prisma.alertRule.findFirst({
      where: { id: ruleId, organizationId },
    });

    if (!existing) {
      throw createError('Alert rule not found', 404, 'NOT_FOUND');
    }

    await prisma.alertRule.delete({
      where: { id: ruleId },
    });

    await this.auditService.log({
      organizationId,
      userId,
      action: 'DELETE_ALERT_RULE',
      entityType: 'AlertRule',
      entityId: ruleId,
    });
  }

  /**
   * Check alert rules against current metrics
   */
  async checkAlertRules(
    organizationId: string,
    metrics: Record<string, number>
  ): Promise<void> {
    const activeRules = await prisma.alertRule.findMany({
      where: { organizationId, isActive: true },
    });

    for (const rule of activeRules) {
      const shouldTrigger = this.evaluateCondition(
        rule.condition as unknown as AlertCondition,
        metrics
      );

      if (shouldTrigger && this.canTriggerAlert(rule)) {
        await this.triggerAlert(organizationId, rule);
      }
    }
  }

  // ============================================
  // Private Helpers
  // ============================================

  private async sendNotificationEmail(data: {
    recipientEmail: string;
    recipientName: string;
    notificationType: NotificationType;
    severity: NotificationSeverity;
    title: string;
    message: string;
    actionUrl?: string;
  }): Promise<boolean> {
    const color = SEVERITY_COLORS[data.severity];
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const actionUrl = data.actionUrl ? `${appUrl}${data.actionUrl}` : appUrl;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${color}; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9fafb; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${data.title}</h1>
    </div>
    <div class="content">
      <p>Hello ${data.recipientName},</p>
      <p>${data.message}</p>
      <p style="text-align: center;">
        <a href="${actionUrl}" class="button">View Details</a>
      </p>
    </div>
    <div class="footer">
      <p>SyncLinqs - Secure 401(k) Integration Platform</p>
    </div>
  </div>
</body>
</html>
`;

    const text = `
${data.title}

Hello ${data.recipientName},

${data.message}

View details: ${actionUrl}

---
SyncLinqs - Secure 401(k) Integration Platform
`;

    // Use the email service's internal send method
    return (this.emailService as unknown as { send: (opts: { to: string; subject: string; html: string; text: string }) => Promise<boolean> }).send({
      to: data.recipientEmail,
      subject: `[${data.severity}] ${data.title}`,
      html,
      text,
    });
  }

  private async sendToOrganizationWebhooks(
    organizationId: string,
    eventType: NotificationType,
    payload: WebhookPayload,
    notificationId?: string
  ): Promise<WebhookDeliveryResult[]> {
    // Get organization webhook configurations
    // For now, just log the webhook - actual implementation would fetch configured webhooks
    logger.debug('Would send webhook', { organizationId, eventType, payload });

    // Create webhook delivery record
    if (notificationId) {
      await prisma.webhookDelivery.create({
        data: {
          organizationId,
          webhookUrl: 'pending', // Would be actual URL
          notificationId,
          payload: payload as object,
          retryCount: 0,
        },
      });
    }

    return [{ success: true }];
  }

  private evaluateCondition(
    condition: AlertCondition,
    metrics: Record<string, number>
  ): boolean {
    const value = metrics[condition.metric];
    if (value === undefined) return false;

    switch (condition.operator) {
      case 'greater_than':
        return value > condition.threshold;
      case 'less_than':
        return value < condition.threshold;
      case 'equals':
        return value === condition.threshold;
      case 'not_equals':
        return value !== condition.threshold;
      case 'greater_or_equal':
        return value >= condition.threshold;
      case 'less_or_equal':
        return value <= condition.threshold;
      default:
        return false;
    }
  }

  private canTriggerAlert(rule: {
    lastTriggeredAt: Date | null;
    cooldownMinutes: number;
  }): boolean {
    if (!rule.lastTriggeredAt) return true;

    const cooldownMs = rule.cooldownMinutes * 60 * 1000;
    const timeSinceLastTrigger = Date.now() - rule.lastTriggeredAt.getTime();

    return timeSinceLastTrigger > cooldownMs;
  }

  private async triggerAlert(
    organizationId: string,
    rule: {
      id: string;
      name: string;
      severity: NotificationSeverity;
      recipients: unknown;
      channels: NotificationChannel[];
    }
  ): Promise<void> {
    const recipients = rule.recipients as string[];

    // Update last triggered time
    await prisma.alertRule.update({
      where: { id: rule.id },
      data: { lastTriggeredAt: new Date() },
    });

    // Send notification to each recipient
    for (const userId of recipients) {
      await this.sendNotification(
        organizationId,
        {
          userId,
          notificationType: 'SYSTEM_ALERT',
          severity: rule.severity,
          title: `Alert: ${rule.name}`,
          message: `Alert rule "${rule.name}" has been triggered.`,
          actionUrl: '/alerts',
        },
        {
          forceChannels: rule.channels,
        }
      );
    }

    logger.info('Alert triggered', { ruleId: rule.id, ruleName: rule.name });
  }

  private formatNotification(notification: {
    id: string;
    organizationId: string;
    userId: string | null;
    notificationType: NotificationType;
    severity: NotificationSeverity;
    title: string;
    message: string;
    actionUrl: string | null;
    metadata: unknown;
    isRead: boolean;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationSummary {
    return {
      id: notification.id,
      organizationId: notification.organizationId,
      userId: notification.userId ?? undefined,
      notificationType: notification.notificationType,
      severity: notification.severity,
      title: notification.title,
      message: notification.message,
      actionUrl: notification.actionUrl ?? undefined,
      metadata: (notification.metadata as Record<string, unknown>) ?? undefined,
      isRead: notification.isRead,
      readAt: notification.readAt ?? undefined,
      createdAt: notification.createdAt,
    };
  }

  private formatAlertRule(rule: {
    id: string;
    organizationId: string;
    name: string;
    description: string | null;
    ruleType: AlertRuleType;
    condition: unknown;
    severity: NotificationSeverity;
    recipients: unknown;
    channels: NotificationChannel[];
    isActive: boolean;
    cooldownMinutes: number;
    lastTriggeredAt: Date | null;
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): AlertRuleSummary {
    return {
      id: rule.id,
      organizationId: rule.organizationId,
      name: rule.name,
      description: rule.description ?? undefined,
      ruleType: rule.ruleType,
      condition: rule.condition as AlertCondition,
      severity: rule.severity,
      recipients: rule.recipients as string[],
      channels: rule.channels,
      isActive: rule.isActive,
      cooldownMinutes: rule.cooldownMinutes,
      lastTriggeredAt: rule.lastTriggeredAt ?? undefined,
      createdBy: rule.createdBy ?? undefined,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }
}
