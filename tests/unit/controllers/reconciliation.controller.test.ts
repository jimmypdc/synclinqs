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

jest.mock('../../../src/services/reconciliation.service');

import { ReconciliationController } from '../../../src/api/controllers/reconciliation.controller';
import { ReconciliationService } from '../../../src/services/reconciliation.service';

describe('ReconciliationController', () => {
  let controller: ReconciliationController;
  let mockService: jest.Mocked<ReconciliationService>;
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    mockService = new ReconciliationService() as jest.Mocked<ReconciliationService>;
    controller = new ReconciliationController();
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
    };

    mockNext = jest.fn();
  });

  describe('run', () => {
    it('should trigger reconciliation with valid data', async () => {
      mockReq.body = {
        sourceSystem: 'adp',
        destinationSystem: 'fidelity',
        reconciliationType: 'CONTRIBUTION',
        reconciliationDate: '2024-06-15T00:00:00.000Z',
      };
      const mockResult = { reportId: 'report-123', status: 'IN_PROGRESS' };
      mockService.performReconciliation = jest.fn().mockResolvedValue(mockResult);

      await controller.run(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.performReconciliation).toHaveBeenCalledWith(
        'org-456',
        {
          sourceSystem: 'adp',
          destinationSystem: 'fidelity',
          reconciliationType: 'CONTRIBUTION',
          reconciliationDate: new Date('2024-06-15T00:00:00.000Z'),
        },
        'user-123',
        undefined
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should pass custom tolerance settings', async () => {
      mockReq.body = {
        sourceSystem: 'adp',
        destinationSystem: 'fidelity',
        reconciliationType: 'CONTRIBUTION',
        reconciliationDate: '2024-06-15T00:00:00.000Z',
        tolerance: {
          amountToleranceCents: 50,
          percentageTolerance: 0.005,
        },
      };
      mockService.performReconciliation = jest.fn().mockResolvedValue({ reportId: 'r-1' });

      await controller.run(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.performReconciliation).toHaveBeenCalledWith(
        'org-456',
        expect.any(Object),
        'user-123',
        {
          amountToleranceCents: 50,
          percentageTolerance: 0.005,
          dateTolerance: 1,
        }
      );
    });

    it('should call next on invalid reconciliationType', async () => {
      mockReq.body = {
        sourceSystem: 'adp',
        destinationSystem: 'fidelity',
        reconciliationType: 'INVALID',
        reconciliationDate: '2024-06-15T00:00:00.000Z',
      };

      await controller.run(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockService.performReconciliation).not.toHaveBeenCalled();
    });

    it('should call next on missing required fields', async () => {
      mockReq.body = {
        sourceSystem: 'adp',
        // missing destinationSystem, reconciliationType, reconciliationDate
      };

      await controller.run(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('listReports', () => {
    it('should return paginated reports', async () => {
      const mockResult = {
        data: [{ id: 'report-1', status: 'RECONCILED' }],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      };
      mockService.listReports = jest.fn().mockResolvedValue(mockResult);

      await controller.listReports(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.listReports).toHaveBeenCalledWith('org-456', {
        page: 1,
        limit: 50,
      });
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should pass filter parameters', async () => {
      mockReq.query = {
        page: '2',
        limit: '25',
        status: 'DISCREPANCIES_FOUND',
        sourceSystem: 'adp',
        destinationSystem: 'fidelity',
      };
      mockService.listReports = jest.fn().mockResolvedValue({ data: [], pagination: {} });

      await controller.listReports(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.listReports).toHaveBeenCalledWith('org-456', {
        page: 2,
        limit: 25,
        status: 'DISCREPANCIES_FOUND',
        sourceSystem: 'adp',
        destinationSystem: 'fidelity',
      });
    });
  });

  describe('getReport', () => {
    it('should return report by id', async () => {
      mockReq.params = { id: 'report-123' };
      const mockReport = { id: 'report-123', status: 'RECONCILED', matchedRecords: 100 };
      mockService.getReportById = jest.fn().mockResolvedValue(mockReport);

      await controller.getReport(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.getReportById).toHaveBeenCalledWith('report-123', 'org-456');
      expect(mockRes.json).toHaveBeenCalledWith(mockReport);
    });

    it('should call next on service error', async () => {
      mockReq.params = { id: 'invalid' };
      mockService.getReportById = jest.fn().mockRejectedValue(new Error('Not found'));

      await controller.getReport(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('listItems', () => {
    it('should return paginated items', async () => {
      mockReq.params = { id: 'report-123' };
      const mockResult = {
        data: [{ id: 'item-1', matchStatus: 'MATCHED' }],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      };
      mockService.listItems = jest.fn().mockResolvedValue(mockResult);

      await controller.listItems(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.listItems).toHaveBeenCalledWith('report-123', 'org-456', {
        page: 1,
        limit: 50,
      });
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should filter by matchStatus', async () => {
      mockReq.params = { id: 'report-123' };
      mockReq.query = { matchStatus: 'AMOUNT_MISMATCH' };
      mockService.listItems = jest.fn().mockResolvedValue({ data: [], pagination: {} });

      await controller.listItems(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.listItems).toHaveBeenCalledWith('report-123', 'org-456', {
        page: 1,
        limit: 50,
        matchStatus: 'AMOUNT_MISMATCH',
      });
    });
  });

  describe('resolveItem', () => {
    it('should resolve item with valid action', async () => {
      mockReq.params = { id: 'item-123' };
      mockReq.body = { resolutionAction: 'MANUAL_REVIEW', resolutionNotes: 'Verified' };
      const mockItem = { id: 'item-123', resolutionAction: 'MANUAL_REVIEW' };
      mockService.resolveItem = jest.fn().mockResolvedValue(mockItem);

      await controller.resolveItem(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.resolveItem).toHaveBeenCalledWith(
        'item-123',
        'org-456',
        { resolutionAction: 'MANUAL_REVIEW', resolutionNotes: 'Verified' },
        'user-123'
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockItem);
    });

    it('should call next on invalid resolutionAction', async () => {
      mockReq.params = { id: 'item-123' };
      mockReq.body = { resolutionAction: 'INVALID' };

      await controller.resolveItem(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockService.resolveItem).not.toHaveBeenCalled();
    });
  });

  describe('bulkResolve', () => {
    it('should bulk resolve items', async () => {
      mockReq.body = {
        itemIds: ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'],
        resolutionAction: 'IGNORED',
      };
      const mockResult = { resolved: 2, failed: 0, errors: [] };
      mockService.bulkResolve = jest.fn().mockResolvedValue(mockResult);

      await controller.bulkResolve(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.bulkResolve).toHaveBeenCalledWith(
        'org-456',
        {
          itemIds: ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'],
          resolutionAction: 'IGNORED',
        },
        'user-123'
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should call next on empty itemIds', async () => {
      mockReq.body = {
        itemIds: [],
        resolutionAction: 'IGNORED',
      };

      await controller.bulkResolve(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next on invalid UUID in itemIds', async () => {
      mockReq.body = {
        itemIds: ['invalid-uuid'],
        resolutionAction: 'IGNORED',
      };

      await controller.bulkResolve(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('getDashboard', () => {
    it('should return dashboard metrics', async () => {
      const mockDashboard = {
        totalReports: 100,
        pendingReports: 5,
        reconciled: 90,
        withDiscrepancies: 4,
        failed: 1,
      };
      mockService.getDashboard = jest.fn().mockResolvedValue(mockDashboard);

      await controller.getDashboard(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockService.getDashboard).toHaveBeenCalledWith('org-456');
      expect(mockRes.json).toHaveBeenCalledWith(mockDashboard);
    });
  });
});
