import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { NotificationService } from '../../services/notification.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  isRead: z.coerce.boolean().optional(),
  notificationType: z
    .enum([
      'SYNC_COMPLETED',
      'SYNC_FAILED',
      'RECONCILIATION_COMPLETED',
      'RECONCILIATION_DISCREPANCIES',
      'ERROR_THRESHOLD_EXCEEDED',
      'JOB_COMPLETED',
      'JOB_FAILED',
      'FILE_UPLOAD_COMPLETED',
      'FILE_UPLOAD_FAILED',
      'CONTRIBUTION_VALIDATION_ERROR',
      'SYSTEM_ALERT',
      'USER_INVITATION',
    ])
    .optional(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', 'SUCCESS']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const updatePreferencesSchema = z.object({
  preferences: z.array(
    z.object({
      channel: z.enum(['IN_APP', 'EMAIL', 'SLACK', 'WEBHOOK']),
      notificationType: z.enum([
        'SYNC_COMPLETED',
        'SYNC_FAILED',
        'RECONCILIATION_COMPLETED',
        'RECONCILIATION_DISCREPANCIES',
        'ERROR_THRESHOLD_EXCEEDED',
        'JOB_COMPLETED',
        'JOB_FAILED',
        'FILE_UPLOAD_COMPLETED',
        'FILE_UPLOAD_FAILED',
        'CONTRIBUTION_VALIDATION_ERROR',
        'SYSTEM_ALERT',
        'USER_INVITATION',
      ]),
      isEnabled: z.boolean(),
      settings: z
        .object({
          emailAddress: z.string().email().optional(),
          slackChannelId: z.string().optional(),
          slackChannelName: z.string().optional(),
          webhookUrl: z.string().url().optional(),
          webhookHeaders: z.record(z.string()).optional(),
          quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
          quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
          timezone: z.string().optional(),
        })
        .optional(),
    })
  ),
});

const createAlertRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  ruleType: z.enum([
    'ERROR_RATE',
    'RECONCILIATION_VARIANCE',
    'SYNC_FAILURE',
    'API_LATENCY',
    'QUEUE_DEPTH',
    'CONTRIBUTION_LIMIT_APPROACH',
  ]),
  condition: z.object({
    metric: z.string(),
    operator: z.enum([
      'greater_than',
      'less_than',
      'equals',
      'not_equals',
      'greater_or_equal',
      'less_or_equal',
    ]),
    threshold: z.number(),
    timeWindowMinutes: z.number().int().min(1).optional(),
    aggregation: z.enum(['sum', 'avg', 'count', 'min', 'max']).optional(),
  }),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', 'SUCCESS']).optional(),
  recipients: z.array(z.string().uuid()).min(1),
  channels: z.array(z.enum(['IN_APP', 'EMAIL', 'SLACK', 'WEBHOOK'])).min(1),
  cooldownMinutes: z.number().int().min(1).max(1440).optional(),
});

const updateAlertRuleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  condition: z
    .object({
      metric: z.string(),
      operator: z.enum([
        'greater_than',
        'less_than',
        'equals',
        'not_equals',
        'greater_or_equal',
        'less_or_equal',
      ]),
      threshold: z.number(),
      timeWindowMinutes: z.number().int().min(1).optional(),
      aggregation: z.enum(['sum', 'avg', 'count', 'min', 'max']).optional(),
    })
    .optional(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', 'SUCCESS']).optional(),
  recipients: z.array(z.string().uuid()).optional(),
  channels: z.array(z.enum(['IN_APP', 'EMAIL', 'SLACK', 'WEBHOOK'])).optional(),
  isActive: z.boolean().optional(),
  cooldownMinutes: z.number().int().min(1).max(1440).optional(),
});

export class NotificationsController {
  private service = new NotificationService();

  /**
   * GET /api/v1/notifications
   * List notifications for current user
   */
  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = listNotificationsQuerySchema.parse(req.query);
      const result = await this.service.listNotifications(
        req.user!.organizationId,
        req.user!.userId,
        query
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/notifications/unread-count
   * Get unread notification count
   */
  getUnreadCount = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const count = await this.service.getUnreadCount(
        req.user!.organizationId,
        req.user!.userId
      );
      res.json(count);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/v1/notifications/:id/read
   * Mark notification as read
   */
  markAsRead = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const notification = await this.service.markAsRead(
        id!,
        req.user!.organizationId,
        req.user!.userId
      );
      res.json(notification);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/notifications/mark-all-read
   * Mark all notifications as read
   */
  markAllAsRead = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.service.markAllAsRead(
        req.user!.organizationId,
        req.user!.userId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/notifications/preferences
   * Get notification preferences
   */
  getPreferences = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const preferences = await this.service.getPreferences(req.user!.userId);
      res.json(preferences);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/v1/notifications/preferences
   * Update notification preferences
   */
  updatePreferences = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = updatePreferencesSchema.parse(req.body);
      const preferences = await this.service.updatePreferences(req.user!.userId, data);
      res.json(preferences);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/alert-rules
   * List alert rules
   */
  listAlertRules = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const rules = await this.service.listAlertRules(req.user!.organizationId);
      res.json(rules);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/alert-rules
   * Create alert rule
   */
  createAlertRule = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = createAlertRuleSchema.parse(req.body);
      const rule = await this.service.createAlertRule(
        req.user!.organizationId,
        data,
        req.user!.userId
      );
      res.status(201).json(rule);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/v1/alert-rules/:id
   * Update alert rule
   */
  updateAlertRule = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const data = updateAlertRuleSchema.parse(req.body);
      const rule = await this.service.updateAlertRule(
        id!,
        req.user!.organizationId,
        data,
        req.user!.userId
      );
      res.json(rule);
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/v1/alert-rules/:id
   * Delete alert rule
   */
  deleteAlertRule = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      await this.service.deleteAlertRule(id!, req.user!.organizationId, req.user!.userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
