import { describe, it, expect, beforeEach } from '@jest/globals';
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../src/api/middleware/auth';

// Mock dependencies before importing controller
jest.mock('../../../src/lib/prisma', () => ({
  prisma: {},
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../src/services/audit.service', () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    log: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../src/services/email.service', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendEmail: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('../../../src/services/notification.service');

import { NotificationsController } from '../../../src/api/controllers/notifications.controller';
import { NotificationService } from '../../../src/services/notification.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let mockService: jest.Mocked<NotificationService>;
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    mockService = new NotificationService() as jest.Mocked<NotificationService>;
    controller = new NotificationsController();
    (controller as any).service = mockService;

    mockReq = {
      user: {
        userId: 'user-123',
        organizationId: 'org-456',
        email: 'test@example.com',
        role: 'admin',
      },
      query: {},
      params: {},
      body: {},
    };

    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('list', () => {
    it('should return paginated notifications', async () => {
      const mockResult = {
        data: [{ id: 'notif-1', title: 'Test', isRead: false }],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      };
      mockService.listNotifications = jest.fn().mockResolvedValue(mockResult);

      await controller.list(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.listNotifications).toHaveBeenCalledWith('org-456', 'user-123', {
        page: 1,
        limit: 50,
      });
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should pass filter parameters', async () => {
      mockReq.query = {
        page: '2',
        limit: '25',
        isRead: 'true',
        notificationType: 'SYNC_FAILED',
        severity: 'HIGH',
      };
      mockService.listNotifications = jest.fn().mockResolvedValue({ data: [], pagination: {} });

      await controller.list(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.listNotifications).toHaveBeenCalledWith('org-456', 'user-123', {
        page: 2,
        limit: 25,
        isRead: true,
        notificationType: 'SYNC_FAILED',
        severity: 'HIGH',
      });
    });

    it('should call next on invalid notificationType', async () => {
      mockReq.query = { notificationType: 'INVALID_TYPE' };

      await controller.list(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      const mockCount = { total: 5, bySeverity: { HIGH: 2, INFO: 3 } };
      mockService.getUnreadCount = jest.fn().mockResolvedValue(mockCount);

      await controller.getUnreadCount(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.getUnreadCount).toHaveBeenCalledWith('org-456', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith(mockCount);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      mockReq.params = { id: 'notif-123' };
      const mockNotification = { id: 'notif-123', isRead: true, readAt: new Date() };
      mockService.markAsRead = jest.fn().mockResolvedValue(mockNotification);

      await controller.markAsRead(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.markAsRead).toHaveBeenCalledWith('notif-123', 'org-456', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith(mockNotification);
    });

    it('should call next on service error', async () => {
      mockReq.params = { id: 'invalid' };
      mockService.markAsRead = jest.fn().mockRejectedValue(new Error('Not found'));

      await controller.markAsRead(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      const mockResult = { updated: 10 };
      mockService.markAllAsRead = jest.fn().mockResolvedValue(mockResult);

      await controller.markAllAsRead(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.markAllAsRead).toHaveBeenCalledWith('org-456', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('getPreferences', () => {
    it('should return user preferences', async () => {
      const mockPreferences = [
        { channel: 'EMAIL', notificationType: 'SYNC_FAILED', isEnabled: true },
      ];
      mockService.getPreferences = jest.fn().mockResolvedValue(mockPreferences);

      await controller.getPreferences(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.getPreferences).toHaveBeenCalledWith('user-123');
      expect(mockRes.json).toHaveBeenCalledWith(mockPreferences);
    });
  });

  describe('updatePreferences', () => {
    it('should update preferences with valid data', async () => {
      mockReq.body = {
        preferences: [
          {
            channel: 'EMAIL',
            notificationType: 'SYNC_FAILED',
            isEnabled: false,
          },
        ],
      };
      const mockUpdated = [{ channel: 'EMAIL', notificationType: 'SYNC_FAILED', isEnabled: false }];
      mockService.updatePreferences = jest.fn().mockResolvedValue(mockUpdated);

      await controller.updatePreferences(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.updatePreferences).toHaveBeenCalledWith('user-123', {
        preferences: [
          {
            channel: 'EMAIL',
            notificationType: 'SYNC_FAILED',
            isEnabled: false,
          },
        ],
      });
      expect(mockRes.json).toHaveBeenCalledWith(mockUpdated);
    });

    it('should call next on invalid channel', async () => {
      mockReq.body = {
        preferences: [
          {
            channel: 'INVALID',
            notificationType: 'SYNC_FAILED',
            isEnabled: true,
          },
        ],
      };

      await controller.updatePreferences(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('listAlertRules', () => {
    it('should return alert rules', async () => {
      const mockRules = [{ id: 'rule-1', name: 'High Error Rate' }];
      mockService.listAlertRules = jest.fn().mockResolvedValue(mockRules);

      await controller.listAlertRules(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.listAlertRules).toHaveBeenCalledWith('org-456');
      expect(mockRes.json).toHaveBeenCalledWith(mockRules);
    });
  });

  describe('createAlertRule', () => {
    it('should create alert rule with valid data', async () => {
      mockReq.body = {
        name: 'High Error Rate',
        ruleType: 'ERROR_RATE',
        condition: {
          metric: 'error_percentage',
          operator: 'greater_than',
          threshold: 5,
        },
        recipients: ['550e8400-e29b-41d4-a716-446655440000'],
        channels: ['EMAIL'],
      };
      const mockRule = { id: 'rule-1', name: 'High Error Rate' };
      mockService.createAlertRule = jest.fn().mockResolvedValue(mockRule);

      await controller.createAlertRule(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.createAlertRule).toHaveBeenCalledWith(
        'org-456',
        {
          name: 'High Error Rate',
          ruleType: 'ERROR_RATE',
          condition: {
            metric: 'error_percentage',
            operator: 'greater_than',
            threshold: 5,
          },
          recipients: ['550e8400-e29b-41d4-a716-446655440000'],
          channels: ['EMAIL'],
        },
        'user-123'
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(mockRule);
    });

    it('should call next on invalid ruleType', async () => {
      mockReq.body = {
        name: 'Test Rule',
        ruleType: 'INVALID',
        condition: { metric: 'test', operator: 'greater_than', threshold: 5 },
        recipients: ['550e8400-e29b-41d4-a716-446655440000'],
        channels: ['EMAIL'],
      };

      await controller.createAlertRule(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next on empty recipients', async () => {
      mockReq.body = {
        name: 'Test Rule',
        ruleType: 'ERROR_RATE',
        condition: { metric: 'test', operator: 'greater_than', threshold: 5 },
        recipients: [],
        channels: ['EMAIL'],
      };

      await controller.createAlertRule(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('updateAlertRule', () => {
    it('should update alert rule', async () => {
      mockReq.params = { id: 'rule-123' };
      mockReq.body = { name: 'Updated Rule', isActive: false };
      const mockRule = { id: 'rule-123', name: 'Updated Rule', isActive: false };
      mockService.updateAlertRule = jest.fn().mockResolvedValue(mockRule);

      await controller.updateAlertRule(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.updateAlertRule).toHaveBeenCalledWith(
        'rule-123',
        'org-456',
        { name: 'Updated Rule', isActive: false },
        'user-123'
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockRule);
    });

    it('should call next on service error', async () => {
      mockReq.params = { id: 'invalid' };
      mockReq.body = { name: 'Test' };
      mockService.updateAlertRule = jest.fn().mockRejectedValue(new Error('Not found'));

      await controller.updateAlertRule(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('deleteAlertRule', () => {
    it('should delete alert rule', async () => {
      mockReq.params = { id: 'rule-123' };
      mockService.deleteAlertRule = jest.fn().mockResolvedValue(undefined);

      await controller.deleteAlertRule(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.deleteAlertRule).toHaveBeenCalledWith('rule-123', 'org-456', 'user-123');
      expect(mockRes.status).toHaveBeenCalledWith(204);
      expect(mockRes.send).toHaveBeenCalled();
    });

    it('should call next on service error', async () => {
      mockReq.params = { id: 'invalid' };
      mockService.deleteAlertRule = jest.fn().mockRejectedValue(new Error('Not found'));

      await controller.deleteAlertRule(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
