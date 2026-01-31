import { describe, it, expect, beforeEach } from '@jest/globals';
import { DeduplicationService } from '../../../src/services/deduplication.service';
import { prisma } from '../../../src/lib/prisma';
import { DeduplicationStatus } from '@prisma/client';

// Mock dependencies
jest.mock('../../../src/lib/prisma', () => ({
  prisma: {
    deduplicationRecord: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    contribution: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    employee: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    deferralElection: {
      updateMany: jest.fn(),
    },
    loan: {
      updateMany: jest.fn(),
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

describe('DeduplicationService', () => {
  let service: DeduplicationService;

  const mockDeduplicationRecord = {
    id: 'dedup-123',
    organizationId: 'org-456',
    originalRecordId: 'record-1',
    duplicateRecordId: 'record-2',
    recordType: 'contribution',
    matchScore: 0.95,
    matchFields: [
      { fieldName: 'employeeId', originalValue: 'emp-1', duplicateValue: 'emp-1', matchType: 'exact', similarity: 1 },
    ],
    status: 'POTENTIAL_DUPLICATE' as DeduplicationStatus,
    resolvedBy: null,
    resolvedAt: null,
    resolutionNotes: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockContribution = {
    id: 'contrib-1',
    employeeId: 'emp-1',
    payrollDate: new Date('2024-06-15'),
    employeePreTax: 50000,
    employeeRoth: 0,
    employerMatch: 25000,
    createdAt: new Date('2024-06-15'),
    employee: { id: 'emp-1', employeeNumber: 'EMP001' },
  };

  const mockEmployee = {
    id: 'emp-1',
    organizationId: 'org-456',
    employeeNumber: 'EMP001',
    ssnEncrypted: '123456789',
    firstNameEncrypted: 'John',
    lastNameEncrypted: 'Doe',
    hireDate: new Date('2020-01-01'),
    createdAt: new Date('2020-01-01'),
    deletedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeduplicationService();
  });

  describe('listRecords', () => {
    it('should return paginated results', async () => {
      (prisma.deduplicationRecord.findMany as jest.Mock).mockResolvedValue([mockDeduplicationRecord]);
      (prisma.deduplicationRecord.count as jest.Mock).mockResolvedValue(1);

      const result = await service.listRecords('org-456', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should filter by status', async () => {
      (prisma.deduplicationRecord.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.deduplicationRecord.count as jest.Mock).mockResolvedValue(0);

      await service.listRecords('org-456', {
        page: 1,
        limit: 10,
        status: 'CONFIRMED_DUPLICATE' as DeduplicationStatus,
      });

      expect(prisma.deduplicationRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'CONFIRMED_DUPLICATE' }),
        })
      );
    });

    it('should filter by recordType', async () => {
      (prisma.deduplicationRecord.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.deduplicationRecord.count as jest.Mock).mockResolvedValue(0);

      await service.listRecords('org-456', { page: 1, limit: 10, recordType: 'employee' });

      expect(prisma.deduplicationRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ recordType: 'employee' }),
        })
      );
    });

    it('should filter by minMatchScore', async () => {
      (prisma.deduplicationRecord.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.deduplicationRecord.count as jest.Mock).mockResolvedValue(0);

      await service.listRecords('org-456', { page: 1, limit: 10, minMatchScore: 0.9 });

      expect(prisma.deduplicationRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ matchScore: { gte: 0.9 } }),
        })
      );
    });

    it('should filter by maxMatchScore', async () => {
      (prisma.deduplicationRecord.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.deduplicationRecord.count as jest.Mock).mockResolvedValue(0);

      await service.listRecords('org-456', { page: 1, limit: 10, maxMatchScore: 0.95 });

      expect(prisma.deduplicationRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ matchScore: expect.objectContaining({ lte: 0.95 }) }),
        })
      );
    });

    it('should filter by date range', async () => {
      (prisma.deduplicationRecord.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.deduplicationRecord.count as jest.Mock).mockResolvedValue(0);

      await service.listRecords('org-456', {
        page: 1,
        limit: 10,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(prisma.deduplicationRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('should order by matchScore descending', async () => {
      (prisma.deduplicationRecord.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.deduplicationRecord.count as jest.Mock).mockResolvedValue(0);

      await service.listRecords('org-456', { page: 1, limit: 10 });

      expect(prisma.deduplicationRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ matchScore: 'desc' }, { createdAt: 'desc' }],
        })
      );
    });
  });

  describe('getRecordById', () => {
    it('should return record with previews', async () => {
      (prisma.deduplicationRecord.findFirst as jest.Mock).mockResolvedValue({
        ...mockDeduplicationRecord,
        resolvedByUser: null,
      });
      (prisma.contribution.findFirst as jest.Mock).mockResolvedValue(mockContribution);

      const result = await service.getRecordById('dedup-123', 'org-456');

      expect(result.id).toBe('dedup-123');
      expect(result.originalRecord).toBeDefined();
      expect(result.duplicateRecord).toBeDefined();
    });

    it('should throw NOT_FOUND for non-existent record', async () => {
      (prisma.deduplicationRecord.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getRecordById('invalid-id', 'org-456')).rejects.toThrow();
    });

    it('should enforce organization isolation', async () => {
      (prisma.deduplicationRecord.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getRecordById('dedup-123', 'different-org')).rejects.toThrow();

      expect(prisma.deduplicationRecord.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dedup-123', organizationId: 'different-org' },
        })
      );
    });
  });

  describe('resolveRecord', () => {
    it('should update status and resolution fields', async () => {
      (prisma.deduplicationRecord.findFirst as jest.Mock).mockResolvedValue(mockDeduplicationRecord);
      (prisma.deduplicationRecord.update as jest.Mock).mockResolvedValue({
        ...mockDeduplicationRecord,
        status: 'NOT_DUPLICATE',
        resolvedBy: 'user-123',
        resolvedAt: new Date(),
      });

      const result = await service.resolveRecord('dedup-123', 'org-456', {
        status: 'NOT_DUPLICATE' as DeduplicationStatus,
        resolutionNotes: 'Verified as different records',
      }, 'user-123');

      expect(result.status).toBe('NOT_DUPLICATE');
      expect(prisma.deduplicationRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'NOT_DUPLICATE',
            resolutionNotes: 'Verified as different records',
            resolvedBy: 'user-123',
          }),
        })
      );
    });

    it('should throw NOT_FOUND for non-existent record', async () => {
      (prisma.deduplicationRecord.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.resolveRecord('invalid-id', 'org-456', {
          status: 'NOT_DUPLICATE' as DeduplicationStatus,
        }, 'user-123')
      ).rejects.toThrow();
    });
  });

  describe('mergeRecords', () => {
    it('should throw error if keepRecordId not in pair', async () => {
      (prisma.deduplicationRecord.findFirst as jest.Mock).mockResolvedValue(mockDeduplicationRecord);

      await expect(
        service.mergeRecords('dedup-123', 'org-456', {
          keepRecordId: 'invalid-record',
          mergeRecordId: 'record-2',
        }, 'user-123')
      ).rejects.toThrow('Keep record ID must be one of the duplicate pair');
    });

    it('should merge contribution records by soft deleting duplicate', async () => {
      (prisma.deduplicationRecord.findFirst as jest.Mock).mockResolvedValue(mockDeduplicationRecord);
      (prisma.contribution.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.deduplicationRecord.update as jest.Mock).mockResolvedValue({
        ...mockDeduplicationRecord,
        status: 'MERGED',
      });

      const result = await service.mergeRecords('dedup-123', 'org-456', {
        keepRecordId: 'record-1',
        mergeRecordId: 'record-2',
      }, 'user-123');

      expect(result.success).toBe(true);
      expect(result.mergedRecordId).toBe('record-1');
      expect(result.deletedRecordId).toBe('record-2');
    });

    it('should merge employee records by reassigning relations', async () => {
      const employeeRecord = {
        ...mockDeduplicationRecord,
        recordType: 'employee',
      };
      (prisma.deduplicationRecord.findFirst as jest.Mock).mockResolvedValue(employeeRecord);
      (prisma.contribution.updateMany as jest.Mock).mockResolvedValue({ count: 5 });
      (prisma.deferralElection.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
      (prisma.loan.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.employee.update as jest.Mock).mockResolvedValue({ id: 'record-2' });
      (prisma.deduplicationRecord.update as jest.Mock).mockResolvedValue({
        ...employeeRecord,
        status: 'MERGED',
      });

      const result = await service.mergeRecords('dedup-123', 'org-456', {
        keepRecordId: 'record-1',
        mergeRecordId: 'record-2',
      }, 'user-123');

      expect(result.success).toBe(true);
      expect(result.relationsUpdated).toBe(8); // 5 + 2 + 1
      expect(result.fieldsUpdated).toContain('contributions');
      expect(result.fieldsUpdated).toContain('deferralElections');
      expect(result.fieldsUpdated).toContain('loans');
    });

    it('should return failure result on error', async () => {
      (prisma.deduplicationRecord.findFirst as jest.Mock).mockResolvedValue(mockDeduplicationRecord);
      (prisma.contribution.updateMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await service.mergeRecords('dedup-123', 'org-456', {
        keepRecordId: 'record-1',
        mergeRecordId: 'record-2',
      }, 'user-123');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Database error');
    });
  });

  describe('runScan', () => {
    it('should scan contributions for duplicates', async () => {
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue([
        { ...mockContribution, id: 'c1' },
        { ...mockContribution, id: 'c2' }, // Same data = potential duplicate
      ]);
      (prisma.deduplicationRecord.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.deduplicationRecord.create as jest.Mock).mockResolvedValue(mockDeduplicationRecord);

      const result = await service.runScan('org-456', { recordType: 'contribution' }, 'user-123');

      expect(result.recordType).toBe('contribution');
      expect(result.recordsScanned).toBeGreaterThanOrEqual(0);
    });

    it('should scan employees for duplicates', async () => {
      (prisma.employee.findMany as jest.Mock).mockResolvedValue([
        { ...mockEmployee, id: 'e1' },
        { ...mockEmployee, id: 'e2' }, // Same SSN = potential duplicate
      ]);
      (prisma.deduplicationRecord.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.deduplicationRecord.create as jest.Mock).mockResolvedValue(mockDeduplicationRecord);

      const result = await service.runScan('org-456', { recordType: 'employee' }, 'user-123');

      expect(result.recordType).toBe('employee');
    });

    it('should respect dryRun option', async () => {
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue([
        { ...mockContribution, id: 'c1' },
        { ...mockContribution, id: 'c2' },
      ]);
      (prisma.deduplicationRecord.findFirst as jest.Mock).mockResolvedValue(null);

      await service.runScan('org-456', { recordType: 'contribution', dryRun: true }, 'user-123');

      expect(prisma.deduplicationRecord.create).not.toHaveBeenCalled();
    });

    it('should return scan statistics', async () => {
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.runScan('org-456', { recordType: 'contribution' }, 'user-123');

      expect(result).toHaveProperty('recordsScanned');
      expect(result).toHaveProperty('potentialDuplicatesFound');
      expect(result).toHaveProperty('scanDurationMs');
      expect(result).toHaveProperty('newDuplicates');
      expect(result).toHaveProperty('existingDuplicates');
    });
  });

  describe('checkDuplicate', () => {
    it('should return isDuplicate:true for exact contribution match', async () => {
      (prisma.contribution.findFirst as jest.Mock).mockResolvedValue(mockContribution);

      const result = await service.checkDuplicate('org-456', 'contribution', {
        employeeId: 'emp-1',
        payrollDate: '2024-06-15',
        employeePreTax: 50000,
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.matchScore).toBe(1.0);
      expect(result.existingRecordId).toBe('contrib-1');
    });

    it('should return isDuplicate:true for exact SSN match (employee)', async () => {
      (prisma.employee.findFirst as jest.Mock).mockResolvedValue(mockEmployee);

      const result = await service.checkDuplicate('org-456', 'employee', {
        ssnEncrypted: '123456789',
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.matchScore).toBe(1.0);
      expect(result.existingRecordId).toBe('emp-1');
    });

    it('should return isDuplicate:false when no match', async () => {
      (prisma.contribution.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.checkDuplicate('org-456', 'contribution', {
        employeeId: 'emp-999',
        payrollDate: '2024-06-15',
        employeePreTax: 50000,
      });

      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return total counts', async () => {
      (prisma.deduplicationRecord.count as jest.Mock).mockResolvedValue(100);
      (prisma.deduplicationRecord.groupBy as jest.Mock)
        .mockResolvedValueOnce([
          { status: 'POTENTIAL_DUPLICATE', _count: 50 },
          { status: 'CONFIRMED_DUPLICATE', _count: 30 },
          { status: 'NOT_DUPLICATE', _count: 15 },
          { status: 'MERGED', _count: 5 },
        ])
        .mockResolvedValueOnce([
          { recordType: 'contribution', _count: 70 },
          { recordType: 'employee', _count: 30 },
        ]);
      (prisma.deduplicationRecord.aggregate as jest.Mock).mockResolvedValue({
        _avg: { matchScore: 0.92 },
      });
      (prisma.deduplicationRecord.findFirst as jest.Mock).mockResolvedValue({
        createdAt: new Date('2024-06-15'),
      });

      const stats = await service.getStats('org-456');

      expect(stats.total).toBe(100);
      expect(stats.potentialDuplicates).toBe(50);
      expect(stats.confirmedDuplicates).toBe(30);
      expect(stats.notDuplicates).toBe(15);
      expect(stats.merged).toBe(5);
    });

    it('should return counts by status', async () => {
      (prisma.deduplicationRecord.count as jest.Mock).mockResolvedValue(100);
      (prisma.deduplicationRecord.groupBy as jest.Mock)
        .mockResolvedValueOnce([
          { status: 'POTENTIAL_DUPLICATE', _count: 50 },
        ])
        .mockResolvedValueOnce([]);
      (prisma.deduplicationRecord.aggregate as jest.Mock).mockResolvedValue({
        _avg: { matchScore: 0.9 },
      });
      (prisma.deduplicationRecord.findFirst as jest.Mock).mockResolvedValue(null);

      const stats = await service.getStats('org-456');

      expect(stats.potentialDuplicates).toBe(50);
      expect(stats.confirmedDuplicates).toBe(0);
    });

    it('should return counts by recordType', async () => {
      (prisma.deduplicationRecord.count as jest.Mock).mockResolvedValue(50);
      (prisma.deduplicationRecord.groupBy as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { recordType: 'contribution', _count: 30 },
          { recordType: 'employee', _count: 20 },
        ]);
      (prisma.deduplicationRecord.aggregate as jest.Mock).mockResolvedValue({
        _avg: { matchScore: 0.88 },
      });
      (prisma.deduplicationRecord.findFirst as jest.Mock).mockResolvedValue(null);

      const stats = await service.getStats('org-456');

      expect(stats.byRecordType.contribution).toBe(30);
      expect(stats.byRecordType.employee).toBe(20);
    });

    it('should return average match score', async () => {
      (prisma.deduplicationRecord.count as jest.Mock).mockResolvedValue(10);
      (prisma.deduplicationRecord.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.deduplicationRecord.aggregate as jest.Mock).mockResolvedValue({
        _avg: { matchScore: 0.95 },
      });
      (prisma.deduplicationRecord.findFirst as jest.Mock).mockResolvedValue(null);

      const stats = await service.getStats('org-456');

      expect(stats.averageMatchScore).toBe(0.95);
    });

    it('should return pending review count', async () => {
      (prisma.deduplicationRecord.count as jest.Mock).mockResolvedValue(25);
      (prisma.deduplicationRecord.groupBy as jest.Mock)
        .mockResolvedValueOnce([{ status: 'POTENTIAL_DUPLICATE', _count: 25 }])
        .mockResolvedValueOnce([]);
      (prisma.deduplicationRecord.aggregate as jest.Mock).mockResolvedValue({
        _avg: { matchScore: 0.9 },
      });
      (prisma.deduplicationRecord.findFirst as jest.Mock).mockResolvedValue(null);

      const stats = await service.getStats('org-456');

      expect(stats.pendingReview).toBe(25);
    });
  });
});
