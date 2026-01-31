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

jest.mock('node-cron', () => ({
  schedule: jest.fn().mockReturnValue({ stop: jest.fn() }),
  validate: jest.fn().mockReturnValue(true),
}));

jest.mock('../../../src/services/job-scheduler.service');

import { JobsController } from '../../../src/api/controllers/jobs.controller';
import { JobSchedulerService } from '../../../src/services/job-scheduler.service';

describe('JobsController', () => {
  let controller: JobsController;
  let mockService: jest.Mocked<JobSchedulerService>;
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    mockService = new JobSchedulerService() as jest.Mocked<JobSchedulerService>;
    controller = new JobsController();
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
    it('should return paginated jobs', async () => {
      const mockResult = {
        data: [{ id: 'job-1', name: 'Daily Sync' }],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      };
      mockService.listJobs = jest.fn().mockResolvedValue(mockResult);

      await controller.list(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.listJobs).toHaveBeenCalledWith('org-456', {
        page: 1,
        limit: 50,
      });
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should pass filter parameters', async () => {
      mockReq.query = {
        page: '2',
        limit: '25',
        jobType: 'CONTRIBUTION_SYNC',
        isActive: 'true',
        sourceSystem: 'adp',
      };
      mockService.listJobs = jest.fn().mockResolvedValue({ data: [], pagination: {} });

      await controller.list(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.listJobs).toHaveBeenCalledWith('org-456', {
        page: 2,
        limit: 25,
        jobType: 'CONTRIBUTION_SYNC',
        isActive: true,
        sourceSystem: 'adp',
      });
    });

    it('should call next on invalid jobType', async () => {
      mockReq.query = { jobType: 'INVALID' };

      await controller.list(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create job with valid data', async () => {
      mockReq.body = {
        name: 'Daily Contribution Sync',
        jobType: 'CONTRIBUTION_SYNC',
        sourceSystem: 'adp',
        destinationSystem: 'fidelity',
        scheduleCron: '0 0 * * *',
      };
      const mockJob = { id: 'job-1', name: 'Daily Contribution Sync' };
      mockService.createJob = jest.fn().mockResolvedValue(mockJob);

      await controller.create(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.createJob).toHaveBeenCalledWith(
        'org-456',
        {
          name: 'Daily Contribution Sync',
          jobType: 'CONTRIBUTION_SYNC',
          sourceSystem: 'adp',
          destinationSystem: 'fidelity',
          scheduleCron: '0 0 * * *',
        },
        'user-123'
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(mockJob);
    });

    it('should call next on missing required fields', async () => {
      mockReq.body = {
        description: 'Missing name and jobType',
      };

      await controller.create(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next on invalid jobType', async () => {
      mockReq.body = {
        name: 'Test Job',
        jobType: 'INVALID_TYPE',
      };

      await controller.create(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('should return job by id', async () => {
      mockReq.params = { id: 'job-123' };
      const mockJob = { id: 'job-123', name: 'Daily Sync', stats: {} };
      mockService.getJobById = jest.fn().mockResolvedValue(mockJob);

      await controller.getById(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.getJobById).toHaveBeenCalledWith('job-123', 'org-456');
      expect(mockRes.json).toHaveBeenCalledWith(mockJob);
    });

    it('should call next on service error', async () => {
      mockReq.params = { id: 'invalid' };
      mockService.getJobById = jest.fn().mockRejectedValue(new Error('Not found'));

      await controller.getById(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('update', () => {
    it('should update job with valid data', async () => {
      mockReq.params = { id: 'job-123' };
      mockReq.body = { name: 'Updated Name', isActive: false };
      const mockJob = { id: 'job-123', name: 'Updated Name', isActive: false };
      mockService.updateJob = jest.fn().mockResolvedValue(mockJob);

      await controller.update(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.updateJob).toHaveBeenCalledWith(
        'job-123',
        'org-456',
        { name: 'Updated Name', isActive: false },
        'user-123'
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockJob);
    });

    it('should allow nullable scheduleCron', async () => {
      mockReq.params = { id: 'job-123' };
      mockReq.body = { scheduleCron: null };
      mockService.updateJob = jest.fn().mockResolvedValue({ id: 'job-123' });

      await controller.update(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.updateJob).toHaveBeenCalledWith(
        'job-123',
        'org-456',
        { scheduleCron: null },
        'user-123'
      );
    });
  });

  describe('delete', () => {
    it('should delete job', async () => {
      mockReq.params = { id: 'job-123' };
      mockService.deleteJob = jest.fn().mockResolvedValue(undefined);

      await controller.delete(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.deleteJob).toHaveBeenCalledWith('job-123', 'org-456', 'user-123');
      expect(mockRes.status).toHaveBeenCalledWith(204);
      expect(mockRes.send).toHaveBeenCalled();
    });

    it('should call next on service error', async () => {
      mockReq.params = { id: 'invalid' };
      mockService.deleteJob = jest.fn().mockRejectedValue(new Error('Not found'));

      await controller.delete(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('execute', () => {
    it('should execute job', async () => {
      mockReq.params = { id: 'job-123' };
      mockReq.body = {};
      const mockResult = { executionId: 'exec-1', status: 'RUNNING' };
      mockService.executeJob = jest.fn().mockResolvedValue(mockResult);

      await controller.execute(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.executeJob).toHaveBeenCalledWith(
        'job-123',
        'org-456',
        'user-123',
        {}
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should pass dryRun option', async () => {
      mockReq.params = { id: 'job-123' };
      mockReq.body = { dryRun: true };
      mockService.executeJob = jest.fn().mockResolvedValue({ executionId: 'exec-1' });

      await controller.execute(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.executeJob).toHaveBeenCalledWith(
        'job-123',
        'org-456',
        'user-123',
        { dryRun: true }
      );
    });
  });

  describe('listExecutions', () => {
    it('should return paginated executions', async () => {
      mockReq.params = { id: 'job-123' };
      const mockResult = {
        data: [{ id: 'exec-1', status: 'COMPLETED' }],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      };
      mockService.listExecutions = jest.fn().mockResolvedValue(mockResult);

      await controller.listExecutions(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.listExecutions).toHaveBeenCalledWith('job-123', 'org-456', {
        page: 1,
        limit: 50,
      });
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should filter by status', async () => {
      mockReq.params = { id: 'job-123' };
      mockReq.query = { status: 'FAILED' };
      mockService.listExecutions = jest.fn().mockResolvedValue({ data: [], pagination: {} });

      await controller.listExecutions(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.listExecutions).toHaveBeenCalledWith('job-123', 'org-456', {
        page: 1,
        limit: 50,
        status: 'FAILED',
      });
    });

    it('should call next on invalid status', async () => {
      mockReq.params = { id: 'job-123' };
      mockReq.query = { status: 'INVALID' };

      await controller.listExecutions(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return job stats', async () => {
      const mockStats = {
        totalJobs: 10,
        activeJobs: 8,
        scheduledJobs: 5,
        runningExecutions: 2,
      };
      mockService.getOverallStats = jest.fn().mockResolvedValue(mockStats);

      await controller.getStats(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.getOverallStats).toHaveBeenCalledWith('org-456');
      expect(mockRes.json).toHaveBeenCalledWith(mockStats);
    });
  });

  describe('validateCron', () => {
    it('should validate valid cron expression', async () => {
      mockReq.body = { cron: '0 0 * * *' };
      const mockValidation = { isValid: true, humanReadable: 'Daily at midnight' };
      const mockScheduleInfo = { nextRun: new Date() };
      mockService.validateCronExpression = jest.fn().mockReturnValue(mockValidation);
      mockService.getScheduleInfo = jest.fn().mockReturnValue(mockScheduleInfo);

      await controller.validateCron(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.validateCronExpression).toHaveBeenCalledWith('0 0 * * *');
      expect(mockRes.json).toHaveBeenCalledWith({
        ...mockValidation,
        scheduleInfo: mockScheduleInfo,
      });
    });

    it('should return 400 for invalid cron', async () => {
      mockReq.body = { cron: 'invalid' };
      const mockValidation = { isValid: false, error: 'Invalid expression' };
      mockService.validateCronExpression = jest.fn().mockReturnValue(mockValidation);

      await controller.validateCron(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(mockValidation);
    });

    it('should call next on empty cron', async () => {
      mockReq.body = { cron: '' };

      await controller.validateCron(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
