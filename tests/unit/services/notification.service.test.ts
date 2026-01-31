import { describe, it, expect, beforeEach } from '@jest/globals';
import { NotificationService } from '../../../src/services/notification.service';
import { prisma } from '../../../src/lib/prisma';
import { NotificationType, NotificationSeverity, NotificationChannel, AlertRuleType } from '@prisma/client';

// Mock dependencies
jest.mock('../../../src/lib/prisma', () => ({
  prisma: {
    notification: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    notificationPreference: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    alertRule: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    webhookDelivery: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../src/services/email.service', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendEmail: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('../../../src/services/audit.service', () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    log: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('NotificationService', () => {
  let service: NotificationService;

  const mockNotification = {
    id: 'notif-123',
    organizationId: 'org-456',
    userId: 'user-789',
    notificationType: 'SYNC_COMPLETED' as NotificationType,
    severity: 'INFO' as NotificationSeverity,
    title: 'Sync Complete',
    message: 'Your sync has completed successfully',
    actionUrl: '/dashboard',
    metadata: {},
    isRead: false,
    readAt: null,
    createdAt: new Date('2024-06-15'),
  };

  const mockAlertRule = {
    id: 'rule-1',
    organizationId: 'org-456',
    name: 'High Error Rate',
    description: 'Alert when error rate exceeds 5%',
    ruleType: 'ERROR_RATE' as AlertRuleType,
    condition: { metric: 'error_percentage', operator: 'greater_than', threshold: 5 },
    severity: 'HIGH' as NotificationSeverity,
    recipients: ['user-1', 'user-2'],
    channels: ['EMAIL', 'SLACK'] as NotificationChannel[],
    isActive: true,
    cooldownMinutes: 60,
    lastTriggeredAt: null,
    createdBy: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService();
  });

  describe('sendNotification', () => {
    it('should create in-app notification', async () => {
      (prisma.notification.create as jest.Mock).mockResolvedValue(mockNotification);
      (prisma.notificationPreference.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.sendNotification('org-456', {
        userId: 'user-789',
        notificationType: 'SYNC_COMPLETED' as NotificationType,
        title: 'Sync Complete',
        message: 'Your sync has completed',
      });

      expect(result.channels.inApp).toBe(true);
      expect(prisma.notification.create).toHaveBeenCalled();
    });

    it('should skip in-app when skipInApp option set', async () => {
      (prisma.notificationPreference.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.sendNotification(
        'org-456',
        {
          userId: 'user-789',
          notificationType: 'SYNC_COMPLETED' as NotificationType,
          title: 'Sync Complete',
          message: 'Your sync has completed',
        },
        { skipInApp: true }
      );

      expect(result.channels.inApp).toBe(false);
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('should track delivery results for all channels', async () => {
      (prisma.notification.create as jest.Mock).mockResolvedValue(mockNotification);
      (prisma.notificationPreference.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.sendNotification('org-456', {
        userId: 'user-789',
        notificationType: 'SYNC_COMPLETED' as NotificationType,
        title: 'Sync Complete',
        message: 'Your sync has completed',
      });

      expect(result).toHaveProperty('channels');
      expect(result.channels).toHaveProperty('inApp');
      expect(result.channels).toHaveProperty('email');
      expect(result.channels).toHaveProperty('slack');
      expect(result.channels).toHaveProperty('webhook');
    });
  });

  describe('listNotifications', () => {
    it('should return paginated notifications', async () => {
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([mockNotification]);
      (prisma.notification.count as jest.Mock).mockResolvedValue(1);

      const result = await service.listNotifications('org-456', 'user-789', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should filter by isRead status', async () => {
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.notification.count as jest.Mock).mockResolvedValue(0);

      await service.listNotifications('org-456', 'user-789', { page: 1, limit: 10, isRead: false });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isRead: false }),
        })
      );
    });

    it('should filter by notificationType', async () => {
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.notification.count as jest.Mock).mockResolvedValue(0);

      await service.listNotifications('org-456', 'user-789', {
        page: 1,
        limit: 10,
        notificationType: 'SYNC_FAILED' as NotificationType,
      });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ notificationType: 'SYNC_FAILED' }),
        })
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return total unread count', async () => {
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([
        { severity: 'INFO' },
        { severity: 'INFO' },
        { severity: 'HIGH' },
        { severity: 'HIGH' },
        { severity: 'CRITICAL' },
      ]);

      const result = await service.getUnreadCount('org-456', 'user-789');

      expect(result.total).toBe(5);
    });
  });

  describe('markAsRead', () => {
    it('should update isRead and readAt', async () => {
      (prisma.notification.findFirst as jest.Mock).mockResolvedValue(mockNotification);
      (prisma.notification.update as jest.Mock).mockResolvedValue({
        ...mockNotification,
        isRead: true,
        readAt: new Date(),
      });

      const result = await service.markAsRead('notif-123', 'org-456', 'user-789');

      expect(result.isRead).toBe(true);
      expect(prisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isRead: true }),
        })
      );
    });

    it('should throw NOT_FOUND for non-existent notification', async () => {
      (prisma.notification.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.markAsRead('invalid-id', 'org-456', 'user-789')).rejects.toThrow();
    });
  });

  describe('markAllAsRead', () => {
    it('should update all unread notifications', async () => {
      (prisma.notification.updateMany as jest.Mock).mockResolvedValue({ count: 10 });

      const result = await service.markAllAsRead('org-456', 'user-789');

      expect(result.updated).toBe(10);
    });
  });

  describe('getPreferences', () => {
    it('should return user preferences ordered by type and channel', async () => {
      (prisma.notificationPreference.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'pref-1',
          userId: 'user-789',
          channel: 'EMAIL' as NotificationChannel,
          notificationType: 'SYNC_COMPLETED' as NotificationType,
          isEnabled: true,
          settings: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getPreferences('user-789');

      expect(result).toHaveLength(1);
    });
  });

  describe('updatePreferences', () => {
    it('should upsert multiple preferences', async () => {
      (prisma.notificationPreference.upsert as jest.Mock).mockResolvedValue({
        id: 'pref-1',
        userId: 'user-789',
        channel: 'EMAIL',
        notificationType: 'SYNC_COMPLETED',
        isEnabled: false,
      });
      (prisma.notificationPreference.findMany as jest.Mock).mockResolvedValue([]);

      await service.updatePreferences('user-789', {
        preferences: [
          {
            channel: 'EMAIL' as NotificationChannel,
            notificationType: 'SYNC_COMPLETED' as NotificationType,
            isEnabled: false,
          },
        ],
      });

      expect(prisma.notificationPreference.upsert).toHaveBeenCalled();
    });
  });

  describe('listAlertRules', () => {
    it('should return all rules for organization', async () => {
      (prisma.alertRule.findMany as jest.Mock).mockResolvedValue([mockAlertRule]);

      const result = await service.listAlertRules('org-456');

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('High Error Rate');
    });
  });

  describe('createAlertRule', () => {
    it('should create rule with all fields', async () => {
      (prisma.alertRule.create as jest.Mock).mockResolvedValue(mockAlertRule);

      const result = await service.createAlertRule('org-456', {
        name: 'High Error Rate',
        ruleType: 'ERROR_RATE' as AlertRuleType,
        condition: { metric: 'error_percentage', operator: 'greater_than', threshold: 5 },
        recipients: ['user-1'],
        channels: ['EMAIL'] as NotificationChannel[],
      }, 'user-123');

      expect(result.name).toBe('High Error Rate');
      expect(prisma.alertRule.create).toHaveBeenCalled();
    });
  });

  describe('updateAlertRule', () => {
    it('should update existing rule', async () => {
      (prisma.alertRule.findFirst as jest.Mock).mockResolvedValue(mockAlertRule);
      (prisma.alertRule.update as jest.Mock).mockResolvedValue({
        ...mockAlertRule,
        name: 'Updated Rule',
      });

      const result = await service.updateAlertRule('rule-1', 'org-456', {
        name: 'Updated Rule',
      }, 'user-123');

      expect(result.name).toBe('Updated Rule');
    });

    it('should throw NOT_FOUND for non-existent rule', async () => {
      (prisma.alertRule.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateAlertRule('invalid-id', 'org-456', { name: 'Test' }, 'user-123')
      ).rejects.toThrow();
    });
  });

  describe('deleteAlertRule', () => {
    it('should delete rule', async () => {
      (prisma.alertRule.findFirst as jest.Mock).mockResolvedValue(mockAlertRule);
      (prisma.alertRule.delete as jest.Mock).mockResolvedValue(mockAlertRule);

      await service.deleteAlertRule('rule-1', 'org-456', 'user-123');

      expect(prisma.alertRule.delete).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
      });
    });

    it('should throw NOT_FOUND for non-existent rule', async () => {
      (prisma.alertRule.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteAlertRule('invalid-id', 'org-456', 'user-123')).rejects.toThrow();
    });
  });
});
