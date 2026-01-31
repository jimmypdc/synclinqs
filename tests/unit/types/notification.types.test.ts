import { describe, it, expect } from '@jest/globals';
import {
  getSeverityColor,
  compareSeverity,
  getNotificationTypeDisplay,
  getChannelDisplay,
  shouldSendToChannel,
  SEVERITY_COLORS,
  SEVERITY_PRIORITY,
} from '../../../src/types/notification.types.js';
import { NotificationType, NotificationSeverity, NotificationChannel } from '@prisma/client';

describe('Notification Types Helper Functions', () => {
  describe('getSeverityColor', () => {
    it('should return correct hex color for CRITICAL', () => {
      expect(getSeverityColor(NotificationSeverity.CRITICAL)).toBe('#dc2626');
    });

    it('should return correct hex color for HIGH', () => {
      expect(getSeverityColor(NotificationSeverity.HIGH)).toBe('#ea580c');
    });

    it('should return correct hex color for MEDIUM', () => {
      expect(getSeverityColor(NotificationSeverity.MEDIUM)).toBe('#ca8a04');
    });

    it('should return correct hex color for LOW', () => {
      expect(getSeverityColor(NotificationSeverity.LOW)).toBe('#2563eb');
    });

    it('should return correct hex color for INFO', () => {
      expect(getSeverityColor(NotificationSeverity.INFO)).toBe('#6b7280');
    });

    it('should return correct hex color for SUCCESS', () => {
      expect(getSeverityColor(NotificationSeverity.SUCCESS)).toBe('#16a34a');
    });
  });

  describe('compareSeverity', () => {
    it('should return negative when first severity is higher priority', () => {
      expect(compareSeverity(NotificationSeverity.CRITICAL, NotificationSeverity.HIGH)).toBeLessThan(0);
      expect(compareSeverity(NotificationSeverity.HIGH, NotificationSeverity.MEDIUM)).toBeLessThan(0);
    });

    it('should return positive when first severity is lower priority', () => {
      expect(compareSeverity(NotificationSeverity.LOW, NotificationSeverity.HIGH)).toBeGreaterThan(0);
      expect(compareSeverity(NotificationSeverity.INFO, NotificationSeverity.CRITICAL)).toBeGreaterThan(0);
    });

    it('should return zero when severities are equal', () => {
      expect(compareSeverity(NotificationSeverity.HIGH, NotificationSeverity.HIGH)).toBe(0);
      expect(compareSeverity(NotificationSeverity.INFO, NotificationSeverity.INFO)).toBe(0);
    });

    it('should order CRITICAL > HIGH > MEDIUM > LOW > INFO > SUCCESS', () => {
      // Lower priority number = higher priority
      expect(SEVERITY_PRIORITY.CRITICAL).toBe(1);
      expect(SEVERITY_PRIORITY.HIGH).toBe(2);
      expect(SEVERITY_PRIORITY.MEDIUM).toBe(3);
      expect(SEVERITY_PRIORITY.LOW).toBe(4);
      expect(SEVERITY_PRIORITY.INFO).toBe(5);
      expect(SEVERITY_PRIORITY.SUCCESS).toBe(6);
    });
  });

  describe('getNotificationTypeDisplay', () => {
    it('should return correct display for SYNC_COMPLETED', () => {
      expect(getNotificationTypeDisplay(NotificationType.SYNC_COMPLETED)).toBe('Sync Completed');
    });

    it('should return correct display for SYNC_FAILED', () => {
      expect(getNotificationTypeDisplay(NotificationType.SYNC_FAILED)).toBe('Sync Failed');
    });

    it('should return correct display for RECONCILIATION_COMPLETED', () => {
      expect(getNotificationTypeDisplay(NotificationType.RECONCILIATION_COMPLETED)).toBe('Reconciliation Completed');
    });

    it('should return correct display for RECONCILIATION_DISCREPANCIES', () => {
      expect(getNotificationTypeDisplay(NotificationType.RECONCILIATION_DISCREPANCIES)).toBe('Reconciliation Discrepancies');
    });

    it('should return correct display for ERROR_THRESHOLD_EXCEEDED', () => {
      expect(getNotificationTypeDisplay(NotificationType.ERROR_THRESHOLD_EXCEEDED)).toBe('Error Threshold Exceeded');
    });

    it('should return correct display for JOB_COMPLETED', () => {
      expect(getNotificationTypeDisplay(NotificationType.JOB_COMPLETED)).toBe('Job Completed');
    });

    it('should return correct display for JOB_FAILED', () => {
      expect(getNotificationTypeDisplay(NotificationType.JOB_FAILED)).toBe('Job Failed');
    });

    it('should return correct display for SYSTEM_ALERT', () => {
      expect(getNotificationTypeDisplay(NotificationType.SYSTEM_ALERT)).toBe('System Alert');
    });
  });

  describe('getChannelDisplay', () => {
    it('should return correct display for IN_APP', () => {
      expect(getChannelDisplay(NotificationChannel.IN_APP)).toBe('In-App');
    });

    it('should return correct display for EMAIL', () => {
      expect(getChannelDisplay(NotificationChannel.EMAIL)).toBe('Email');
    });

    it('should return correct display for SLACK', () => {
      expect(getChannelDisplay(NotificationChannel.SLACK)).toBe('Slack');
    });

    it('should return correct display for WEBHOOK', () => {
      expect(getChannelDisplay(NotificationChannel.WEBHOOK)).toBe('Webhook');
    });
  });

  describe('shouldSendToChannel', () => {
    describe('CRITICAL severity', () => {
      it('should return true for all channels', () => {
        expect(shouldSendToChannel(NotificationType.SYNC_FAILED, NotificationSeverity.CRITICAL, NotificationChannel.IN_APP)).toBe(true);
        expect(shouldSendToChannel(NotificationType.SYNC_FAILED, NotificationSeverity.CRITICAL, NotificationChannel.EMAIL)).toBe(true);
        expect(shouldSendToChannel(NotificationType.SYNC_FAILED, NotificationSeverity.CRITICAL, NotificationChannel.SLACK)).toBe(true);
        expect(shouldSendToChannel(NotificationType.SYNC_FAILED, NotificationSeverity.CRITICAL, NotificationChannel.WEBHOOK)).toBe(true);
      });
    });

    describe('HIGH severity', () => {
      it('should return true for IN_APP, EMAIL, SLACK', () => {
        expect(shouldSendToChannel(NotificationType.SYNC_FAILED, NotificationSeverity.HIGH, NotificationChannel.IN_APP)).toBe(true);
        expect(shouldSendToChannel(NotificationType.SYNC_FAILED, NotificationSeverity.HIGH, NotificationChannel.EMAIL)).toBe(true);
        expect(shouldSendToChannel(NotificationType.SYNC_FAILED, NotificationSeverity.HIGH, NotificationChannel.SLACK)).toBe(true);
      });

      it('should return false for WEBHOOK', () => {
        expect(shouldSendToChannel(NotificationType.SYNC_FAILED, NotificationSeverity.HIGH, NotificationChannel.WEBHOOK)).toBe(false);
      });
    });

    describe('MEDIUM severity', () => {
      it('should return true for IN_APP, EMAIL only', () => {
        expect(shouldSendToChannel(NotificationType.SYNC_COMPLETED, NotificationSeverity.MEDIUM, NotificationChannel.IN_APP)).toBe(true);
        expect(shouldSendToChannel(NotificationType.SYNC_COMPLETED, NotificationSeverity.MEDIUM, NotificationChannel.EMAIL)).toBe(true);
      });

      it('should return false for SLACK and WEBHOOK', () => {
        expect(shouldSendToChannel(NotificationType.SYNC_COMPLETED, NotificationSeverity.MEDIUM, NotificationChannel.SLACK)).toBe(false);
        expect(shouldSendToChannel(NotificationType.SYNC_COMPLETED, NotificationSeverity.MEDIUM, NotificationChannel.WEBHOOK)).toBe(false);
      });
    });

    describe('LOW severity', () => {
      it('should return true for IN_APP only', () => {
        expect(shouldSendToChannel(NotificationType.SYNC_COMPLETED, NotificationSeverity.LOW, NotificationChannel.IN_APP)).toBe(true);
      });

      it('should return false for EMAIL, SLACK, WEBHOOK', () => {
        expect(shouldSendToChannel(NotificationType.SYNC_COMPLETED, NotificationSeverity.LOW, NotificationChannel.EMAIL)).toBe(false);
        expect(shouldSendToChannel(NotificationType.SYNC_COMPLETED, NotificationSeverity.LOW, NotificationChannel.SLACK)).toBe(false);
        expect(shouldSendToChannel(NotificationType.SYNC_COMPLETED, NotificationSeverity.LOW, NotificationChannel.WEBHOOK)).toBe(false);
      });
    });

    describe('INFO severity', () => {
      it('should return true for IN_APP only', () => {
        expect(shouldSendToChannel(NotificationType.SYNC_COMPLETED, NotificationSeverity.INFO, NotificationChannel.IN_APP)).toBe(true);
      });

      it('should return false for other channels', () => {
        expect(shouldSendToChannel(NotificationType.SYNC_COMPLETED, NotificationSeverity.INFO, NotificationChannel.EMAIL)).toBe(false);
        expect(shouldSendToChannel(NotificationType.SYNC_COMPLETED, NotificationSeverity.INFO, NotificationChannel.SLACK)).toBe(false);
        expect(shouldSendToChannel(NotificationType.SYNC_COMPLETED, NotificationSeverity.INFO, NotificationChannel.WEBHOOK)).toBe(false);
      });
    });

    describe('SUCCESS severity', () => {
      it('should return true for IN_APP only', () => {
        expect(shouldSendToChannel(NotificationType.SYNC_COMPLETED, NotificationSeverity.SUCCESS, NotificationChannel.IN_APP)).toBe(true);
      });

      it('should return false for other channels', () => {
        expect(shouldSendToChannel(NotificationType.SYNC_COMPLETED, NotificationSeverity.SUCCESS, NotificationChannel.EMAIL)).toBe(false);
        expect(shouldSendToChannel(NotificationType.SYNC_COMPLETED, NotificationSeverity.SUCCESS, NotificationChannel.SLACK)).toBe(false);
        expect(shouldSendToChannel(NotificationType.SYNC_COMPLETED, NotificationSeverity.SUCCESS, NotificationChannel.WEBHOOK)).toBe(false);
      });
    });
  });

  describe('SEVERITY_COLORS', () => {
    it('should have all severity levels defined', () => {
      expect(Object.keys(SEVERITY_COLORS)).toHaveLength(6);
      expect(SEVERITY_COLORS.CRITICAL).toBeDefined();
      expect(SEVERITY_COLORS.HIGH).toBeDefined();
      expect(SEVERITY_COLORS.MEDIUM).toBeDefined();
      expect(SEVERITY_COLORS.LOW).toBeDefined();
      expect(SEVERITY_COLORS.INFO).toBeDefined();
      expect(SEVERITY_COLORS.SUCCESS).toBeDefined();
    });

    it('should have valid hex color format', () => {
      const hexColorRegex = /^#[0-9a-f]{6}$/i;
      Object.values(SEVERITY_COLORS).forEach(color => {
        expect(color).toMatch(hexColorRegex);
      });
    });
  });
});
