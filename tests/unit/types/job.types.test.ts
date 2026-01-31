import { describe, it, expect } from '@jest/globals';
import {
  getJobTypeDisplay,
  getStatusDisplay,
  getTriggerTypeDisplay,
  isJobRunning,
  isJobComplete,
  isJobSuccessful,
  calculateSuccessRate,
  parseCronExpression,
  describeCronExpression,
  calculateNextRunTime,
  JOB_TYPE_DISPLAY,
  JOB_STATUS_DISPLAY,
  TRIGGER_TYPE_DISPLAY,
} from '../../../src/types/job.types.js';
import { SyncJobType, JobExecutionStatus, JobTriggerType } from '@prisma/client';

describe('Job Types Helper Functions', () => {
  describe('getJobTypeDisplay', () => {
    it('should return correct display for CONTRIBUTION_SYNC', () => {
      expect(getJobTypeDisplay(SyncJobType.CONTRIBUTION_SYNC)).toBe('Contribution Sync');
    });

    it('should return correct display for EMPLOYEE_SYNC', () => {
      expect(getJobTypeDisplay(SyncJobType.EMPLOYEE_SYNC)).toBe('Employee Sync');
    });

    it('should return correct display for RECONCILIATION', () => {
      expect(getJobTypeDisplay(SyncJobType.RECONCILIATION)).toBe('Reconciliation');
    });

    it('should return correct display for FILE_EXPORT', () => {
      expect(getJobTypeDisplay(SyncJobType.FILE_EXPORT)).toBe('File Export');
    });

    it('should return correct display for CLEANUP', () => {
      expect(getJobTypeDisplay(SyncJobType.CLEANUP)).toBe('Cleanup');
    });

    it('should return correct display for REPORT_GENERATION', () => {
      expect(getJobTypeDisplay(SyncJobType.REPORT_GENERATION)).toBe('Report Generation');
    });
  });

  describe('getStatusDisplay', () => {
    it('should return correct display for PENDING', () => {
      expect(getStatusDisplay(JobExecutionStatus.PENDING)).toBe('Pending');
    });

    it('should return correct display for RUNNING', () => {
      expect(getStatusDisplay(JobExecutionStatus.RUNNING)).toBe('Running');
    });

    it('should return correct display for COMPLETED', () => {
      expect(getStatusDisplay(JobExecutionStatus.COMPLETED)).toBe('Completed');
    });

    it('should return correct display for FAILED', () => {
      expect(getStatusDisplay(JobExecutionStatus.FAILED)).toBe('Failed');
    });

    it('should return correct display for PARTIAL', () => {
      expect(getStatusDisplay(JobExecutionStatus.PARTIAL)).toBe('Partial');
    });

    it('should return correct display for CANCELLED', () => {
      expect(getStatusDisplay(JobExecutionStatus.CANCELLED)).toBe('Cancelled');
    });
  });

  describe('getTriggerTypeDisplay', () => {
    it('should return correct display for SCHEDULED', () => {
      expect(getTriggerTypeDisplay(JobTriggerType.SCHEDULED)).toBe('Scheduled');
    });

    it('should return correct display for MANUAL', () => {
      expect(getTriggerTypeDisplay(JobTriggerType.MANUAL)).toBe('Manual');
    });

    it('should return correct display for API', () => {
      expect(getTriggerTypeDisplay(JobTriggerType.API)).toBe('API');
    });

    it('should return correct display for WEBHOOK', () => {
      expect(getTriggerTypeDisplay(JobTriggerType.WEBHOOK)).toBe('Webhook');
    });

    it('should return correct display for SYSTEM', () => {
      expect(getTriggerTypeDisplay(JobTriggerType.SYSTEM)).toBe('System');
    });
  });

  describe('isJobRunning', () => {
    it('should return true for RUNNING status', () => {
      expect(isJobRunning(JobExecutionStatus.RUNNING)).toBe(true);
    });

    it('should return true for PENDING status', () => {
      expect(isJobRunning(JobExecutionStatus.PENDING)).toBe(true);
    });

    it('should return false for COMPLETED status', () => {
      expect(isJobRunning(JobExecutionStatus.COMPLETED)).toBe(false);
    });

    it('should return false for FAILED status', () => {
      expect(isJobRunning(JobExecutionStatus.FAILED)).toBe(false);
    });

    it('should return false for PARTIAL status', () => {
      expect(isJobRunning(JobExecutionStatus.PARTIAL)).toBe(false);
    });

    it('should return false for CANCELLED status', () => {
      expect(isJobRunning(JobExecutionStatus.CANCELLED)).toBe(false);
    });
  });

  describe('isJobComplete', () => {
    it('should return true for COMPLETED status', () => {
      expect(isJobComplete(JobExecutionStatus.COMPLETED)).toBe(true);
    });

    it('should return true for FAILED status', () => {
      expect(isJobComplete(JobExecutionStatus.FAILED)).toBe(true);
    });

    it('should return true for PARTIAL status', () => {
      expect(isJobComplete(JobExecutionStatus.PARTIAL)).toBe(true);
    });

    it('should return true for CANCELLED status', () => {
      expect(isJobComplete(JobExecutionStatus.CANCELLED)).toBe(true);
    });

    it('should return false for RUNNING status', () => {
      expect(isJobComplete(JobExecutionStatus.RUNNING)).toBe(false);
    });

    it('should return false for PENDING status', () => {
      expect(isJobComplete(JobExecutionStatus.PENDING)).toBe(false);
    });
  });

  describe('isJobSuccessful', () => {
    it('should return true only for COMPLETED status', () => {
      expect(isJobSuccessful(JobExecutionStatus.COMPLETED)).toBe(true);
    });

    it('should return false for all other statuses', () => {
      expect(isJobSuccessful(JobExecutionStatus.PENDING)).toBe(false);
      expect(isJobSuccessful(JobExecutionStatus.RUNNING)).toBe(false);
      expect(isJobSuccessful(JobExecutionStatus.FAILED)).toBe(false);
      expect(isJobSuccessful(JobExecutionStatus.PARTIAL)).toBe(false);
      expect(isJobSuccessful(JobExecutionStatus.CANCELLED)).toBe(false);
    });
  });

  describe('calculateSuccessRate', () => {
    it('should return 0 when total is 0', () => {
      expect(calculateSuccessRate(0, 0)).toBe(0);
    });

    it('should return 100 when all successful', () => {
      expect(calculateSuccessRate(10, 10)).toBe(100);
    });

    it('should return correct percentage with 2 decimal places', () => {
      expect(calculateSuccessRate(7, 10)).toBe(70);
      expect(calculateSuccessRate(1, 3)).toBe(33.33);
      expect(calculateSuccessRate(2, 3)).toBe(66.67);
    });

    it('should handle partial success rates', () => {
      expect(calculateSuccessRate(5, 10)).toBe(50);
      expect(calculateSuccessRate(25, 100)).toBe(25);
    });

    it('should handle single execution', () => {
      expect(calculateSuccessRate(1, 1)).toBe(100);
      expect(calculateSuccessRate(0, 1)).toBe(0);
    });

    it('should handle large numbers', () => {
      expect(calculateSuccessRate(999, 1000)).toBe(99.9);
    });
  });

  describe('parseCronExpression', () => {
    it('should return null for expressions with less than 5 parts', () => {
      expect(parseCronExpression('0 0 *')).toBeNull();
      expect(parseCronExpression('0 0')).toBeNull();
      expect(parseCronExpression('0')).toBeNull();
    });

    it('should return valid ScheduleInfo for valid expressions', () => {
      const result = parseCronExpression('0 0 * * *');
      expect(result).not.toBeNull();
      expect(result?.isValid).toBe(true);
      expect(result?.cron).toBe('0 0 * * *');
    });

    it('should handle 6-part cron expressions', () => {
      const result = parseCronExpression('0 0 0 * * *');
      expect(result).not.toBeNull();
      expect(result?.isValid).toBe(true);
    });

    it('should include human readable description', () => {
      const result = parseCronExpression('0 0 * * *');
      expect(result?.humanReadable).toBe('Daily at midnight');
    });
  });

  describe('describeCronExpression', () => {
    it('should return "Daily at midnight" for "0 0 * * *"', () => {
      expect(describeCronExpression('0 0 * * *')).toBe('Daily at midnight');
    });

    it('should return "Every hour" for "0 * * * *"', () => {
      expect(describeCronExpression('0 * * * *')).toBe('Every hour');
    });

    it('should return "Every minute" for "* * * * *"', () => {
      expect(describeCronExpression('* * * * *')).toBe('Every minute');
    });

    it('should return "Every 5 minutes" for "*/5 * * * *"', () => {
      expect(describeCronExpression('*/5 * * * *')).toBe('Every 5 minutes');
    });

    it('should return "Every 15 minutes" for "*/15 * * * *"', () => {
      expect(describeCronExpression('*/15 * * * *')).toBe('Every 15 minutes');
    });

    it('should return "Weekdays at 9:00 AM" for "0 9 * * 1-5"', () => {
      expect(describeCronExpression('0 9 * * 1-5')).toBe('Weekdays at 9:00 AM');
    });

    it('should return raw cron for unrecognized patterns', () => {
      expect(describeCronExpression('30 14 1 * *')).toBe('30 14 1 * *');
    });

    it('should return "Invalid cron expression" for invalid input', () => {
      expect(describeCronExpression('invalid')).toBe('Invalid cron expression');
    });
  });

  describe('calculateNextRunTime', () => {
    it('should return null (placeholder implementation)', () => {
      expect(calculateNextRunTime('0 0 * * *')).toBeNull();
    });

    it('should accept timezone parameter', () => {
      expect(calculateNextRunTime('0 0 * * *', 'America/New_York')).toBeNull();
    });
  });

  describe('JOB_TYPE_DISPLAY', () => {
    it('should have all job types defined', () => {
      expect(Object.keys(JOB_TYPE_DISPLAY)).toHaveLength(7);
      expect(JOB_TYPE_DISPLAY.CONTRIBUTION_SYNC).toBeDefined();
      expect(JOB_TYPE_DISPLAY.EMPLOYEE_SYNC).toBeDefined();
      expect(JOB_TYPE_DISPLAY.ELECTION_SYNC).toBeDefined();
      expect(JOB_TYPE_DISPLAY.RECONCILIATION).toBeDefined();
      expect(JOB_TYPE_DISPLAY.FILE_EXPORT).toBeDefined();
      expect(JOB_TYPE_DISPLAY.CLEANUP).toBeDefined();
      expect(JOB_TYPE_DISPLAY.REPORT_GENERATION).toBeDefined();
    });
  });

  describe('JOB_STATUS_DISPLAY', () => {
    it('should have all status types defined', () => {
      expect(Object.keys(JOB_STATUS_DISPLAY)).toHaveLength(6);
      expect(JOB_STATUS_DISPLAY.PENDING).toBeDefined();
      expect(JOB_STATUS_DISPLAY.RUNNING).toBeDefined();
      expect(JOB_STATUS_DISPLAY.COMPLETED).toBeDefined();
      expect(JOB_STATUS_DISPLAY.FAILED).toBeDefined();
      expect(JOB_STATUS_DISPLAY.PARTIAL).toBeDefined();
      expect(JOB_STATUS_DISPLAY.CANCELLED).toBeDefined();
    });
  });

  describe('TRIGGER_TYPE_DISPLAY', () => {
    it('should have all trigger types defined', () => {
      expect(Object.keys(TRIGGER_TYPE_DISPLAY)).toHaveLength(5);
      expect(TRIGGER_TYPE_DISPLAY.SCHEDULED).toBeDefined();
      expect(TRIGGER_TYPE_DISPLAY.MANUAL).toBeDefined();
      expect(TRIGGER_TYPE_DISPLAY.API).toBeDefined();
      expect(TRIGGER_TYPE_DISPLAY.WEBHOOK).toBeDefined();
      expect(TRIGGER_TYPE_DISPLAY.SYSTEM).toBeDefined();
    });
  });
});
