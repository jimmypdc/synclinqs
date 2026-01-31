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

jest.mock('../../../src/services/deduplication.service');

import { DeduplicationController } from '../../../src/api/controllers/deduplication.controller';
import { DeduplicationService } from '../../../src/services/deduplication.service';

describe('DeduplicationController', () => {
  let controller: DeduplicationController;
  let mockService: jest.Mocked<DeduplicationService>;
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock service instance
    mockService = new DeduplicationService() as jest.Mocked<DeduplicationService>;

    // Create controller (it will use the mocked service)
    controller = new DeduplicationController();
    (controller as any).service = mockService;

    // Mock request
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

    // Mock response
    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };

    // Mock next function
    mockNext = jest.fn();
  });

  describe('list', () => {
    it('should return paginated records with default query', async () => {
      const mockResult = {
        data: [{ id: 'rec-1', status: 'POTENTIAL_DUPLICATE' }],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      };
      mockService.listRecords = jest.fn().mockResolvedValue(mockResult);

      await controller.list(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.listRecords).toHaveBeenCalledWith('org-456', {
        page: 1,
        limit: 50,
      });
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should pass query parameters to service', async () => {
      mockReq.query = {
        page: '2',
        limit: '25',
        status: 'CONFIRMED_DUPLICATE',
        recordType: 'contribution',
        minMatchScore: '0.8',
      };
      mockService.listRecords = jest.fn().mockResolvedValue({ data: [], pagination: {} });

      await controller.list(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.listRecords).toHaveBeenCalledWith('org-456', {
        page: 2,
        limit: 25,
        status: 'CONFIRMED_DUPLICATE',
        recordType: 'contribution',
        minMatchScore: 0.8,
      });
    });

    it('should call next on validation error', async () => {
      mockReq.query = { status: 'INVALID_STATUS' };

      await controller.list(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should call next on service error', async () => {
      mockService.listRecords = jest.fn().mockRejectedValue(new Error('Service error'));

      await controller.list(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getById', () => {
    it('should return record by id', async () => {
      const mockRecord = { id: 'rec-123', status: 'POTENTIAL_DUPLICATE' };
      mockReq.params = { id: 'rec-123' };
      mockService.getRecordById = jest.fn().mockResolvedValue(mockRecord);

      await controller.getById(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.getRecordById).toHaveBeenCalledWith('rec-123', 'org-456');
      expect(mockRes.json).toHaveBeenCalledWith(mockRecord);
    });

    it('should call next on service error', async () => {
      mockReq.params = { id: 'invalid-id' };
      mockService.getRecordById = jest.fn().mockRejectedValue(new Error('Not found'));

      await controller.getById(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('resolve', () => {
    it('should resolve record with valid status', async () => {
      mockReq.params = { id: 'rec-123' };
      mockReq.body = { status: 'NOT_DUPLICATE', resolutionNotes: 'Reviewed' };
      const mockRecord = { id: 'rec-123', status: 'NOT_DUPLICATE' };
      mockService.resolveRecord = jest.fn().mockResolvedValue(mockRecord);

      await controller.resolve(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.resolveRecord).toHaveBeenCalledWith(
        'rec-123',
        'org-456',
        { status: 'NOT_DUPLICATE', resolutionNotes: 'Reviewed' },
        'user-123'
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockRecord);
    });

    it('should call next on invalid status', async () => {
      mockReq.params = { id: 'rec-123' };
      mockReq.body = { status: 'INVALID' };

      await controller.resolve(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockService.resolveRecord).not.toHaveBeenCalled();
    });
  });

  describe('merge', () => {
    it('should merge records with valid UUIDs', async () => {
      mockReq.params = { id: 'rec-123' };
      mockReq.body = {
        keepRecordId: '550e8400-e29b-41d4-a716-446655440000',
        mergeRecordId: '550e8400-e29b-41d4-a716-446655440001',
      };
      const mockResult = { success: true, mergedRecordId: 'kept-123' };
      mockService.mergeRecords = jest.fn().mockResolvedValue(mockResult);

      await controller.merge(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.mergeRecords).toHaveBeenCalledWith(
        'rec-123',
        'org-456',
        {
          keepRecordId: '550e8400-e29b-41d4-a716-446655440000',
          mergeRecordId: '550e8400-e29b-41d4-a716-446655440001',
        },
        'user-123'
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should call next on invalid UUID', async () => {
      mockReq.params = { id: 'rec-123' };
      mockReq.body = {
        keepRecordId: 'invalid-uuid',
        mergeRecordId: 'also-invalid',
      };

      await controller.merge(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockService.mergeRecords).not.toHaveBeenCalled();
    });
  });

  describe('scan', () => {
    it('should run scan with valid record type', async () => {
      mockReq.body = { recordType: 'contribution' };
      const mockResult = { recordsScanned: 100, duplicatesFound: 5 };
      mockService.runScan = jest.fn().mockResolvedValue(mockResult);

      await controller.scan(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.runScan).toHaveBeenCalledWith(
        'org-456',
        { recordType: 'contribution' },
        'user-123'
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should pass all scan options', async () => {
      mockReq.body = {
        recordType: 'employee',
        scope: 'recent',
        minMatchScore: 0.9,
        dryRun: true,
      };
      mockService.runScan = jest.fn().mockResolvedValue({ recordsScanned: 50 });

      await controller.scan(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.runScan).toHaveBeenCalledWith(
        'org-456',
        {
          recordType: 'employee',
          scope: 'recent',
          minMatchScore: 0.9,
          dryRun: true,
        },
        'user-123'
      );
    });

    it('should call next on invalid record type', async () => {
      mockReq.body = { recordType: 'invalid' };

      await controller.scan(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockService.runScan).not.toHaveBeenCalled();
    });
  });

  describe('check', () => {
    it('should check for duplicates', async () => {
      mockReq.body = {
        recordType: 'contribution',
        recordData: { amount: 10000, employeeId: 'emp-1' },
      };
      const mockResult = { isDuplicate: true, matchScore: 0.95, matchingRecordId: 'rec-1' };
      mockService.checkDuplicate = jest.fn().mockResolvedValue(mockResult);

      await controller.check(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.checkDuplicate).toHaveBeenCalledWith(
        'org-456',
        'contribution',
        { amount: 10000, employeeId: 'emp-1' }
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should call next on missing recordData', async () => {
      mockReq.body = { recordType: 'contribution' };

      await controller.check(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      const mockStats = {
        totalRecords: 100,
        potentialDuplicates: 10,
        confirmedDuplicates: 5,
        mergedRecords: 3,
      };
      mockService.getStats = jest.fn().mockResolvedValue(mockStats);

      await controller.getStats(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.getStats).toHaveBeenCalledWith('org-456');
      expect(mockRes.json).toHaveBeenCalledWith(mockStats);
    });

    it('should call next on service error', async () => {
      mockService.getStats = jest.fn().mockRejectedValue(new Error('DB error'));

      await controller.getStats(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
