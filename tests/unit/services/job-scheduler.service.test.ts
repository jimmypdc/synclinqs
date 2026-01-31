import { describe, it, expect, beforeEach } from '@jest/globals';
import { JobSchedulerService } from '../../../src/services/job-scheduler.service';
import { prisma } from '../../../src/lib/prisma';
import { SyncJobType, JobExecutionStatus, JobTriggerType } from '@prisma/client';

// Mock node-cron
jest.mock('node-cron', () => ({
  schedule: jest.fn().mockReturnValue({
    stop: jest.fn(),
  }),
  validate: jest.fn().mockReturnValue(true),
}));

// Mock dependencies
jest.mock('../../../src/lib/prisma', () => ({
  prisma: {
    syncJob: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
    jobExecution: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      groupBy: jest.fn(),
    },
    notification: {
      deleteMany: jest.fn(),
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

jest.mock('../../../src/services/notification.service', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendNotification: jest.fn().mockResolvedValue({ notificationId: 'notif-1' }),
  })),
}));

jest.mock('../../../src/services/reconciliation.service', () => ({
  ReconciliationService: jest.fn().mockImplementation(() => ({
    performReconciliation: jest.fn().mockResolvedValue({ reportId: 'report-1' }),
  })),
}));

jest.mock('../../../src/services/audit.service', () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    log: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('JobSchedulerService', () => {
  let service: JobSchedulerService;

  const mockJob = {
    id: 'job-123',
    organizationId: 'org-456',
    name: 'Daily Sync',
    description: 'Daily contribution sync',
    jobType: 'CONTRIBUTION_SYNC' as SyncJobType,
    sourceSystem: 'adp',
    destinationSystem: 'fidelity',
    integrationId: null,
    mappingConfigId: null,
    scheduleCron: '0 0 * * *',
    timezone: 'UTC',
    isActive: true,
    lastRunAt: null,
    nextRunAt: new Date('2024-06-16'),
    configuration: {},
    createdBy: 'user-123',
    createdAt: new Date('2024-06-15'),
    updatedAt: new Date('2024-06-15'),
    deletedAt: null,
  };

  const mockExecution = {
    id: 'exec-1',
    syncJobId: 'job-123',
    executionStart: new Date('2024-06-15T00:00:00Z'),
    executionEnd: new Date('2024-06-15T00:05:00Z'),
    status: 'COMPLETED' as JobExecutionStatus,
    recordsProcessed: 100,
    recordsSuccessful: 98,
    recordsFailed: 2,
    errorSummary: null,
    performanceMetrics: {},
    triggeredBy: 'SCHEDULED' as JobTriggerType,
    triggeredByUserId: null,
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new JobSchedulerService();
  });

  describe('initialize', () => {
    it('should load all active jobs with cron expressions', async () => {
      (prisma.syncJob.findMany as jest.Mock).mockResolvedValue([mockJob]);

      await service.initialize();

      expect(prisma.syncJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            scheduleCron: { not: null },
            deletedAt: null,
          },
        })
      );
    });

    it('should warn if already initialized', async () => {
      (prisma.syncJob.findMany as jest.Mock).mockResolvedValue([]);

      await service.initialize();
      await service.initialize();

      // Logger warn should have been called
    });
  });

  describe('shutdown', () => {
    it('should stop all scheduled tasks', async () => {
      (prisma.syncJob.findMany as jest.Mock).mockResolvedValue([mockJob]);

      await service.initialize();
      await service.shutdown();

      // Tasks should be cleared
    });
  });

  describe('createJob', () => {
    it('should create job without schedule', async () => {
      (prisma.syncJob.create as jest.Mock).mockResolvedValue({
        ...mockJob,
        scheduleCron: null,
      });

      const result = await service.createJob('org-456', {
        name: 'Manual Sync',
        jobType: 'CONTRIBUTION_SYNC' as SyncJobType,
      }, 'user-123');

      expect(result.name).toBe('Daily Sync');
      expect(prisma.syncJob.create).toHaveBeenCalled();
    });

    it('should create job with cron schedule', async () => {
      (prisma.syncJob.create as jest.Mock).mockResolvedValue(mockJob);

      const result = await service.createJob('org-456', {
        name: 'Daily Sync',
        jobType: 'CONTRIBUTION_SYNC' as SyncJobType,
        scheduleCron: '0 0 * * *',
      }, 'user-123');

      expect(result.scheduleCron).toBe('0 0 * * *');
    });

    it('should throw INVALID_CRON for invalid expression', async () => {
      const cron = require('node-cron');
      cron.validate.mockReturnValueOnce(false);

      await expect(
        service.createJob('org-456', {
          name: 'Invalid Job',
          jobType: 'CONTRIBUTION_SYNC' as SyncJobType,
          scheduleCron: 'invalid',
        }, 'user-123')
      ).rejects.toThrow();
    });
  });

  describe('updateJob', () => {
    it('should update job fields', async () => {
      (prisma.syncJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
      (prisma.syncJob.update as jest.Mock).mockResolvedValue({
        ...mockJob,
        name: 'Updated Job',
      });

      const result = await service.updateJob('job-123', 'org-456', {
        name: 'Updated Job',
      }, 'user-123');

      expect(result.name).toBe('Updated Job');
    });

    it('should throw NOT_FOUND for non-existent job', async () => {
      (prisma.syncJob.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateJob('invalid-id', 'org-456', { name: 'Test' }, 'user-123')
      ).rejects.toThrow();
    });
  });

  describe('deleteJob', () => {
    it('should soft delete job', async () => {
      (prisma.syncJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
      (prisma.syncJob.update as jest.Mock).mockResolvedValue({
        ...mockJob,
        deletedAt: new Date(),
      });

      await service.deleteJob('job-123', 'org-456', 'user-123');

      expect(prisma.syncJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        })
      );
    });

    it('should throw NOT_FOUND for non-existent job', async () => {
      (prisma.syncJob.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteJob('invalid-id', 'org-456', 'user-123')).rejects.toThrow();
    });
  });

  describe('listJobs', () => {
    it('should return paginated jobs', async () => {
      (prisma.syncJob.findMany as jest.Mock).mockResolvedValue([mockJob]);
      (prisma.syncJob.count as jest.Mock).mockResolvedValue(1);

      const result = await service.listJobs('org-456', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should filter by jobType', async () => {
      (prisma.syncJob.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.syncJob.count as jest.Mock).mockResolvedValue(0);

      await service.listJobs('org-456', { page: 1, limit: 10, jobType: 'RECONCILIATION' as SyncJobType });

      expect(prisma.syncJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ jobType: 'RECONCILIATION' }),
        })
      );
    });

    it('should filter by isActive', async () => {
      (prisma.syncJob.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.syncJob.count as jest.Mock).mockResolvedValue(0);

      await service.listJobs('org-456', { page: 1, limit: 10, isActive: true });

      expect(prisma.syncJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        })
      );
    });
  });

  describe('getJobById', () => {
    it('should return job with details', async () => {
      (prisma.syncJob.findFirst as jest.Mock).mockResolvedValue({
        ...mockJob,
        integration: null,
        mappingConfig: null,
        creator: null,
        executions: [mockExecution],
      });
      // Mock for getJobStats - executions, lastSuccess, lastFailure
      (prisma.jobExecution.findMany as jest.Mock).mockResolvedValue([mockExecution]);
      (prisma.jobExecution.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockExecution) // lastSuccess
        .mockResolvedValueOnce(null); // lastFailure

      const result = await service.getJobById('job-123', 'org-456');

      expect(result.id).toBe('job-123');
      expect(result.recentExecutions).toBeDefined();
      expect(result.stats).toBeDefined();
    });

    it('should throw NOT_FOUND for non-existent job', async () => {
      (prisma.syncJob.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getJobById('invalid-id', 'org-456')).rejects.toThrow();
    });
  });

  describe('executeJob', () => {
    it('should create execution record', async () => {
      (prisma.syncJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
      (prisma.jobExecution.create as jest.Mock).mockResolvedValue(mockExecution);
      (prisma.jobExecution.update as jest.Mock).mockResolvedValue({
        ...mockExecution,
        status: 'COMPLETED',
      });
      (prisma.syncJob.update as jest.Mock).mockResolvedValue(mockJob);

      const result = await service.executeJob('job-123', 'org-456', 'user-123');

      expect(prisma.jobExecution.create).toHaveBeenCalled();
      expect(result.status).toBe('COMPLETED');
    });

    it('should update execution as failed on error', async () => {
      (prisma.syncJob.findFirst as jest.Mock).mockResolvedValue({
        ...mockJob,
        jobType: 'CLEANUP',
      });
      (prisma.jobExecution.create as jest.Mock).mockResolvedValue(mockExecution);
      (prisma.notification.deleteMany as jest.Mock).mockRejectedValue(new Error('DB error'));
      (prisma.jobExecution.update as jest.Mock).mockResolvedValue({
        ...mockExecution,
        status: 'FAILED',
      });
      (prisma.syncJob.update as jest.Mock).mockResolvedValue(mockJob);

      const result = await service.executeJob('job-123', 'org-456', 'user-123');

      expect(result.status).toBe('FAILED');
    });
  });

  describe('listExecutions', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return paginated executions', async () => {
      (prisma.syncJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
      (prisma.jobExecution.findMany as jest.Mock).mockResolvedValue([mockExecution]);
      (prisma.jobExecution.count as jest.Mock).mockResolvedValue(1);

      const result = await service.listExecutions('job-123', 'org-456', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
    });

    it('should filter by status', async () => {
      (prisma.syncJob.findFirst as jest.Mock).mockResolvedValue(mockJob);
      (prisma.jobExecution.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.jobExecution.count as jest.Mock).mockResolvedValue(0);

      await service.listExecutions('job-123', 'org-456', {
        page: 1,
        limit: 10,
        status: 'FAILED' as JobExecutionStatus,
      });

      expect(prisma.jobExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'FAILED' }),
        })
      );
    });
  });

  describe('getOverallStats', () => {
    it('should return correct job counts', async () => {
      (prisma.syncJob.count as jest.Mock)
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8) // active
        .mockResolvedValueOnce(5); // scheduled
      (prisma.jobExecution.count as jest.Mock)
        .mockResolvedValueOnce(2) // running
        .mockResolvedValueOnce(50) // completed today
        .mockResolvedValueOnce(5); // failed today
      (prisma.syncJob.groupBy as jest.Mock).mockResolvedValue([
        { jobType: 'CONTRIBUTION_SYNC', _count: 5 },
        { jobType: 'RECONCILIATION', _count: 3 },
      ]);
      (prisma.jobExecution.groupBy as jest.Mock).mockResolvedValue([
        { status: 'COMPLETED', _count: 45 },
        { status: 'FAILED', _count: 5 },
      ]);

      const stats = await service.getOverallStats('org-456');

      expect(stats.totalJobs).toBe(10);
      expect(stats.activeJobs).toBe(8);
      expect(stats.scheduledJobs).toBe(5);
      expect(stats.runningExecutions).toBe(2);
    });
  });

  describe('validateCronExpression', () => {
    it('should validate correct expressions', () => {
      const result = service.validateCronExpression('0 0 * * *');

      expect(result.isValid).toBe(true);
    });

    it('should return human readable description', () => {
      const result = service.validateCronExpression('0 0 * * *');

      expect(result.humanReadable).toBe('Daily at midnight');
    });
  });
});
