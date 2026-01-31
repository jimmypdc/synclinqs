import { describe, it, expect, beforeEach } from '@jest/globals';
import { ReconciliationService } from '../../../src/services/reconciliation.service';
import { prisma } from '../../../src/lib/prisma';
import { ReconciliationStatus, ReconciliationMatchStatus, MappingType } from '@prisma/client';

// Mock dependencies
jest.mock('../../../src/lib/prisma', () => ({
  prisma: {
    reconciliationReport: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
    reconciliationItem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    contribution: {
      findMany: jest.fn(),
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

jest.mock('../../../src/services/audit.service', () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    log: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('ReconciliationService', () => {
  let service: ReconciliationService;

  const mockReport = {
    id: 'report-123',
    organizationId: 'org-456',
    reconciliationDate: new Date('2024-06-15'),
    sourceSystem: 'adp',
    destinationSystem: 'fidelity',
    reconciliationType: 'CONTRIBUTION' as MappingType,
    totalRecords: 100,
    matchedRecords: 90,
    unmatchedSourceRecords: 5,
    unmatchedDestinationRecords: 3,
    amountDiscrepancies: 2,
    totalSourceAmount: BigInt(1000000),
    totalDestinationAmount: BigInt(995000),
    varianceAmount: BigInt(5000),
    status: 'RECONCILED' as ReconciliationStatus,
    reconciledBy: null,
    reconciledAt: null,
    notes: null,
    createdAt: new Date('2024-06-15'),
    updatedAt: new Date('2024-06-15'),
  };

  const mockItem = {
    id: 'item-1',
    reconciliationReportId: 'report-123',
    employeeId: 'emp-1',
    contributionId: 'contrib-1',
    matchStatus: 'MATCHED' as ReconciliationMatchStatus,
    sourceRecord: { amount: 10000 },
    destinationRecord: { amount: 10000 },
    sourceAmount: BigInt(10000),
    destinationAmount: BigInt(10000),
    varianceAmount: BigInt(0),
    discrepancyReason: null,
    resolutionAction: null,
    resolutionNotes: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReconciliationService();
  });

  describe('performReconciliation', () => {
    it('should create new report when no existing report', async () => {
      (prisma.reconciliationReport.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.reconciliationReport.create as jest.Mock).mockResolvedValue({
        ...mockReport,
        status: 'IN_PROGRESS',
      });
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.reconciliationItem.createMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.reconciliationReport.update as jest.Mock).mockResolvedValue(mockReport);

      const result = await service.performReconciliation(
        'org-456',
        {
          sourceSystem: 'adp',
          destinationSystem: 'fidelity',
          reconciliationType: 'CONTRIBUTION' as MappingType,
          reconciliationDate: new Date('2024-06-15'),
        },
        'user-123'
      );

      expect(prisma.reconciliationReport.create).toHaveBeenCalled();
      expect(result.reportId).toBeDefined();
    });

    it('should throw error when report already exists and not failed', async () => {
      (prisma.reconciliationReport.findFirst as jest.Mock).mockResolvedValue({
        ...mockReport,
        status: 'RECONCILED',
      });

      await expect(
        service.performReconciliation(
          'org-456',
          {
            sourceSystem: 'adp',
            destinationSystem: 'fidelity',
            reconciliationType: 'CONTRIBUTION' as MappingType,
            reconciliationDate: new Date('2024-06-15'),
          },
          'user-123'
        )
      ).rejects.toThrow('Reconciliation report already exists');
    });

    it('should update existing failed report', async () => {
      (prisma.reconciliationReport.findFirst as jest.Mock).mockResolvedValue({
        ...mockReport,
        status: 'FAILED',
      });
      (prisma.reconciliationReport.update as jest.Mock).mockResolvedValue({
        ...mockReport,
        status: 'IN_PROGRESS',
      });
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.reconciliationItem.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.reconciliationItem.createMany as jest.Mock).mockResolvedValue({ count: 0 });

      await service.performReconciliation(
        'org-456',
        {
          sourceSystem: 'adp',
          destinationSystem: 'fidelity',
          reconciliationType: 'CONTRIBUTION' as MappingType,
          reconciliationDate: new Date('2024-06-15'),
        },
        'user-123'
      );

      expect(prisma.reconciliationReport.update).toHaveBeenCalled();
    });
  });

  describe('listReports', () => {
    it('should return paginated results', async () => {
      (prisma.reconciliationReport.findMany as jest.Mock).mockResolvedValue([mockReport]);
      (prisma.reconciliationReport.count as jest.Mock).mockResolvedValue(1);

      const result = await service.listReports('org-456', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should filter by status', async () => {
      (prisma.reconciliationReport.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.reconciliationReport.count as jest.Mock).mockResolvedValue(0);

      await service.listReports('org-456', { page: 1, limit: 10, status: 'RECONCILED' as ReconciliationStatus });

      expect(prisma.reconciliationReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'RECONCILED' }),
        })
      );
    });

    it('should filter by source/destination system', async () => {
      (prisma.reconciliationReport.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.reconciliationReport.count as jest.Mock).mockResolvedValue(0);

      await service.listReports('org-456', {
        page: 1,
        limit: 10,
        sourceSystem: 'adp',
        destinationSystem: 'fidelity',
      });

      expect(prisma.reconciliationReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sourceSystem: 'adp',
            destinationSystem: 'fidelity',
          }),
        })
      );
    });
  });

  describe('getReportById', () => {
    it('should return report with items', async () => {
      (prisma.reconciliationReport.findFirst as jest.Mock).mockResolvedValue({
        ...mockReport,
        items: [mockItem],
        reconciledByUser: null,
      });

      const result = await service.getReportById('report-123', 'org-456');

      expect(result.id).toBe('report-123');
      expect(result.items).toBeDefined();
    });

    it('should throw NOT_FOUND for non-existent report', async () => {
      (prisma.reconciliationReport.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getReportById('invalid-id', 'org-456')).rejects.toThrow();
    });
  });

  describe('listItems', () => {
    it('should return paginated items', async () => {
      (prisma.reconciliationItem.findMany as jest.Mock).mockResolvedValue([mockItem]);
      (prisma.reconciliationItem.count as jest.Mock).mockResolvedValue(1);
      (prisma.reconciliationReport.findFirst as jest.Mock).mockResolvedValue(mockReport);

      const result = await service.listItems('report-123', 'org-456', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
    });

    it('should filter by matchStatus', async () => {
      (prisma.reconciliationItem.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.reconciliationItem.count as jest.Mock).mockResolvedValue(0);
      (prisma.reconciliationReport.findFirst as jest.Mock).mockResolvedValue(mockReport);

      await service.listItems('report-123', 'org-456', {
        page: 1,
        limit: 10,
        matchStatus: 'AMOUNT_MISMATCH' as ReconciliationMatchStatus,
      });

      expect(prisma.reconciliationItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ matchStatus: 'AMOUNT_MISMATCH' }),
        })
      );
    });
  });

  describe('resolveItem', () => {
    const mockItemWithReport = {
      ...mockItem,
      reconciliationReport: { organizationId: 'org-456' },
    };

    it('should update resolution fields', async () => {
      (prisma.reconciliationItem.findFirst as jest.Mock).mockResolvedValue(mockItemWithReport);
      (prisma.reconciliationItem.update as jest.Mock).mockResolvedValue({
        ...mockItem,
        resolutionAction: 'MANUAL_REVIEW',
        resolvedBy: 'user-123',
        resolvedAt: new Date(),
      });
      (prisma.reconciliationItem.count as jest.Mock).mockResolvedValue(0);

      const result = await service.resolveItem('item-1', 'org-456', {
        resolutionAction: 'MANUAL_REVIEW',
        resolutionNotes: 'Verified manually',
      }, 'user-123');

      expect(prisma.reconciliationItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resolutionAction: 'MANUAL_REVIEW',
          }),
        })
      );
    });

    it('should throw NOT_FOUND for non-existent item', async () => {
      (prisma.reconciliationItem.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.resolveItem('invalid-id', 'org-456', {
          resolutionAction: 'MANUAL_REVIEW',
        }, 'user-123')
      ).rejects.toThrow();
    });
  });

  describe('bulkResolve', () => {
    const mockItemWithReport = {
      ...mockItem,
      reconciliationReport: { organizationId: 'org-456' },
    };

    it('should resolve multiple items', async () => {
      (prisma.reconciliationItem.findFirst as jest.Mock)
        .mockResolvedValue(mockItemWithReport);
      (prisma.reconciliationItem.update as jest.Mock).mockResolvedValue({
        ...mockItem,
        resolutionAction: 'IGNORED',
      });
      (prisma.reconciliationItem.count as jest.Mock).mockResolvedValue(0);

      const result = await service.bulkResolve('org-456', {
        itemIds: ['item-1', 'item-2'],
        resolutionAction: 'IGNORED',
      }, 'user-123');

      expect(result.resolved).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should track success and failure counts', async () => {
      (prisma.reconciliationItem.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockItemWithReport)
        .mockResolvedValueOnce(null);
      (prisma.reconciliationItem.update as jest.Mock).mockResolvedValue({
        ...mockItem,
        resolutionAction: 'IGNORED',
      });
      (prisma.reconciliationItem.count as jest.Mock).mockResolvedValue(0);

      const result = await service.bulkResolve('org-456', {
        itemIds: ['item-1', 'item-2'],
        resolutionAction: 'IGNORED',
      }, 'user-123');

      expect(result.resolved).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('getDashboard', () => {
    it('should return correct counts by status', async () => {
      (prisma.reconciliationReport.count as jest.Mock)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(10) // pending
        .mockResolvedValueOnce(80) // reconciled
        .mockResolvedValueOnce(8) // discrepancies
        .mockResolvedValueOnce(2); // failed
      (prisma.reconciliationReport.findMany as jest.Mock)
        .mockResolvedValueOnce([mockReport]) // recent reports
        .mockResolvedValueOnce([]); // trend data
      (prisma.reconciliationReport.groupBy as jest.Mock).mockResolvedValue([
        { sourceSystem: 'adp', destinationSystem: 'fidelity', _count: 50, _avg: { matchedRecords: 90 } },
      ]);

      const dashboard = await service.getDashboard('org-456');

      expect(dashboard.totalReports).toBe(100);
      expect(dashboard.pendingReports).toBe(10);
      expect(dashboard.reconciled).toBe(80);
      expect(dashboard.withDiscrepancies).toBe(8);
      expect(dashboard.failed).toBe(2);
    });
  });
});
