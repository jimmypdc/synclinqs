import { prisma } from '../lib/prisma.js';
import { createError } from '../api/middleware/errorHandler.js';
import { AuditService } from './audit.service.js';
import { DeduplicationStatus } from '@prisma/client';
import {
  DeduplicationRecordSummary,
  DeduplicationRecordDetail,
  RecordType,
  RecordPreview,
  MatchFieldResult,
  ListDeduplicationQuery,
  DeduplicationScanOptions,
  ResolveDeduplicationInput,
  MergeRecordsInput,
  MergeResult,
  DeduplicationStats,
  ScanResult,
  MatchingConfig,
  getMatchingConfig,
  calculateTotalMatchScore,
  isPotentialDuplicate,
  stringSimilarity,
  normalizeSSN,
  normalizeName,
} from '../types/deduplication.types.js';
import { logger } from '../utils/logger.js';

export class DeduplicationService {
  private auditService = new AuditService();

  // ============================================
  // Deduplication Record Management
  // ============================================

  /**
   * List deduplication records
   */
  async listRecords(
    organizationId: string,
    query: ListDeduplicationQuery
  ): Promise<{
    data: DeduplicationRecordSummary[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where: Record<string, unknown> = { organizationId };

    if (query.status) where.status = query.status;
    if (query.recordType) where.recordType = query.recordType;
    if (query.minMatchScore !== undefined) {
      where.matchScore = { gte: query.minMatchScore };
    }
    if (query.maxMatchScore !== undefined) {
      where.matchScore = {
        ...(where.matchScore as Record<string, number> || {}),
        lte: query.maxMatchScore,
      };
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate)
        (where.createdAt as Record<string, Date>).gte = new Date(query.startDate);
      if (query.endDate)
        (where.createdAt as Record<string, Date>).lte = new Date(query.endDate);
    }

    const [records, total] = await Promise.all([
      prisma.deduplicationRecord.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ matchScore: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.deduplicationRecord.count({ where }),
    ]);

    return {
      data: records.map((r) => this.formatRecordSummary(r)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * Get deduplication record by ID with full details
   */
  async getRecordById(
    recordId: string,
    organizationId: string
  ): Promise<DeduplicationRecordDetail> {
    const record = await prisma.deduplicationRecord.findFirst({
      where: { id: recordId, organizationId },
      include: {
        resolvedByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!record) {
      throw createError('Deduplication record not found', 404, 'NOT_FOUND');
    }

    // Fetch the actual records
    const [originalRecord, duplicateRecord] = await Promise.all([
      this.getRecordPreview(record.recordType as RecordType, record.originalRecordId, organizationId),
      this.getRecordPreview(record.recordType as RecordType, record.duplicateRecordId, organizationId),
    ]);

    return {
      ...this.formatRecordSummary(record),
      originalRecord,
      duplicateRecord,
      resolvedByUser: record.resolvedByUser ?? undefined,
    };
  }

  /**
   * Resolve a deduplication record
   */
  async resolveRecord(
    recordId: string,
    organizationId: string,
    input: ResolveDeduplicationInput,
    userId: string
  ): Promise<DeduplicationRecordSummary> {
    const record = await prisma.deduplicationRecord.findFirst({
      where: { id: recordId, organizationId },
    });

    if (!record) {
      throw createError('Deduplication record not found', 404, 'NOT_FOUND');
    }

    const updated = await prisma.deduplicationRecord.update({
      where: { id: recordId },
      data: {
        status: input.status,
        resolutionNotes: input.resolutionNotes,
        resolvedBy: userId,
        resolvedAt: new Date(),
      },
    });

    await this.auditService.log({
      organizationId,
      userId,
      action: 'RESOLVE_DEDUPLICATION',
      entityType: 'DeduplicationRecord',
      entityId: recordId,
      newValues: { status: input.status, resolutionNotes: input.resolutionNotes },
    });

    return this.formatRecordSummary(updated);
  }

  /**
   * Merge two duplicate records
   */
  async mergeRecords(
    recordId: string,
    organizationId: string,
    input: MergeRecordsInput,
    userId: string
  ): Promise<MergeResult> {
    const dedupRecord = await prisma.deduplicationRecord.findFirst({
      where: { id: recordId, organizationId },
    });

    if (!dedupRecord) {
      throw createError('Deduplication record not found', 404, 'NOT_FOUND');
    }

    if (
      dedupRecord.originalRecordId !== input.keepRecordId &&
      dedupRecord.duplicateRecordId !== input.keepRecordId
    ) {
      throw createError('Keep record ID must be one of the duplicate pair', 400, 'INVALID_INPUT');
    }

    const mergeRecordId =
      dedupRecord.originalRecordId === input.keepRecordId
        ? dedupRecord.duplicateRecordId
        : dedupRecord.originalRecordId;

    const recordType = dedupRecord.recordType as RecordType;
    let fieldsUpdated: string[] = [];
    let relationsUpdated = 0;

    try {
      if (recordType === 'contribution') {
        // For contributions, update references and soft delete the duplicate
        const updateResult = await prisma.contribution.updateMany({
          where: { id: mergeRecordId },
          data: { deletedAt: new Date(), updatedBy: userId },
        });
        relationsUpdated = updateResult.count;
      } else if (recordType === 'employee') {
        // For employees, this is more complex - need to move all related records
        // Update contributions to point to kept employee
        const contribResult = await prisma.contribution.updateMany({
          where: { employeeId: mergeRecordId },
          data: { employeeId: input.keepRecordId },
        });
        relationsUpdated += contribResult.count;

        // Update deferral elections
        const electionResult = await prisma.deferralElection.updateMany({
          where: { employeeId: mergeRecordId },
          data: { employeeId: input.keepRecordId },
        });
        relationsUpdated += electionResult.count;

        // Update loans
        const loanResult = await prisma.loan.updateMany({
          where: { employeeId: mergeRecordId },
          data: { employeeId: input.keepRecordId },
        });
        relationsUpdated += loanResult.count;

        // Soft delete the duplicate employee
        await prisma.employee.update({
          where: { id: mergeRecordId },
          data: { deletedAt: new Date(), updatedBy: userId },
        });

        fieldsUpdated = ['contributions', 'deferralElections', 'loans'];
      }

      // Update deduplication record as merged
      await prisma.deduplicationRecord.update({
        where: { id: recordId },
        data: {
          status: 'MERGED',
          resolvedBy: userId,
          resolvedAt: new Date(),
          resolutionNotes: `Merged into ${input.keepRecordId}`,
        },
      });

      await this.auditService.log({
        organizationId,
        userId,
        action: 'MERGE_DUPLICATES',
        entityType: 'DeduplicationRecord',
        entityId: recordId,
        newValues: {
          keepRecordId: input.keepRecordId,
          mergeRecordId,
          relationsUpdated,
        },
      });

      return {
        success: true,
        mergedRecordId: input.keepRecordId,
        deletedRecordId: mergeRecordId,
        fieldsUpdated,
        relationsUpdated,
      };
    } catch (error) {
      return {
        success: false,
        mergedRecordId: input.keepRecordId,
        deletedRecordId: mergeRecordId,
        fieldsUpdated,
        relationsUpdated,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  // ============================================
  // Duplicate Detection
  // ============================================

  /**
   * Run a deduplication scan
   */
  async runScan(
    organizationId: string,
    options: DeduplicationScanOptions,
    userId: string
  ): Promise<ScanResult> {
    const startTime = Date.now();
    const config = getMatchingConfig(options.recordType);
    const minScore = options.minMatchScore ?? config.minimumScore;

    logger.info('Starting deduplication scan', {
      organizationId,
      recordType: options.recordType,
      minScore,
    });

    let recordsScanned = 0;
    let potentialDuplicatesFound = 0;
    let newDuplicates = 0;
    let existingDuplicates = 0;

    if (options.recordType === 'contribution') {
      const result = await this.scanContributions(organizationId, config, minScore, options.dryRun);
      recordsScanned = result.scanned;
      potentialDuplicatesFound = result.found;
      newDuplicates = result.newCount;
      existingDuplicates = result.existingCount;
    } else if (options.recordType === 'employee') {
      const result = await this.scanEmployees(organizationId, config, minScore, options.dryRun);
      recordsScanned = result.scanned;
      potentialDuplicatesFound = result.found;
      newDuplicates = result.newCount;
      existingDuplicates = result.existingCount;
    }

    const scanDurationMs = Date.now() - startTime;

    logger.info('Deduplication scan completed', {
      organizationId,
      recordType: options.recordType,
      recordsScanned,
      potentialDuplicatesFound,
      newDuplicates,
      scanDurationMs,
    });

    return {
      recordType: options.recordType,
      recordsScanned,
      potentialDuplicatesFound,
      scanDurationMs,
      newDuplicates,
      existingDuplicates,
    };
  }

  /**
   * Check if a record is a potential duplicate (real-time check)
   */
  async checkDuplicate(
    organizationId: string,
    recordType: RecordType,
    recordData: Record<string, unknown>
  ): Promise<{ isDuplicate: boolean; matchScore?: number; existingRecordId?: string }> {
    const config = getMatchingConfig(recordType);

    if (recordType === 'contribution') {
      return this.checkContributionDuplicate(organizationId, recordData, config);
    } else if (recordType === 'employee') {
      return this.checkEmployeeDuplicate(organizationId, recordData, config);
    }

    return { isDuplicate: false };
  }

  /**
   * Get deduplication statistics
   */
  async getStats(organizationId: string): Promise<DeduplicationStats> {
    const [total, byStatus, byRecordType, avgScore, lastScan] = await Promise.all([
      prisma.deduplicationRecord.count({ where: { organizationId } }),
      prisma.deduplicationRecord.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: true,
      }),
      prisma.deduplicationRecord.groupBy({
        by: ['recordType'],
        where: { organizationId },
        _count: true,
      }),
      prisma.deduplicationRecord.aggregate({
        where: { organizationId },
        _avg: { matchScore: true },
      }),
      prisma.deduplicationRecord.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const statusCounts: Record<DeduplicationStatus, number> = {
      POTENTIAL_DUPLICATE: 0,
      CONFIRMED_DUPLICATE: 0,
      NOT_DUPLICATE: 0,
      MERGED: 0,
    };
    for (const item of byStatus) {
      statusCounts[item.status] = item._count;
    }

    const recordTypeCounts: Record<RecordType, number> = {
      contribution: 0,
      employee: 0,
      election: 0,
      loan: 0,
    };
    for (const item of byRecordType) {
      recordTypeCounts[item.recordType as RecordType] = item._count;
    }

    return {
      total,
      potentialDuplicates: statusCounts.POTENTIAL_DUPLICATE,
      confirmedDuplicates: statusCounts.CONFIRMED_DUPLICATE,
      notDuplicates: statusCounts.NOT_DUPLICATE,
      merged: statusCounts.MERGED,
      byRecordType: recordTypeCounts,
      averageMatchScore: avgScore._avg.matchScore ?? 0,
      lastScanAt: lastScan?.createdAt,
      pendingReview: statusCounts.POTENTIAL_DUPLICATE,
    };
  }

  // ============================================
  // Private Scan Methods
  // ============================================

  private async scanContributions(
    organizationId: string,
    config: MatchingConfig,
    minScore: number,
    dryRun?: boolean
  ): Promise<{ scanned: number; found: number; newCount: number; existingCount: number }> {
    // Get recent contributions
    const contributions = await prisma.contribution.findMany({
      where: {
        employee: { organizationId },
        deletedAt: null,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
      },
      include: { employee: { select: { id: true, employeeNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });

    let scanned = 0;
    let found = 0;
    let newCount = 0;
    let existingCount = 0;

    // Compare each contribution with others
    for (let i = 0; i < contributions.length; i++) {
      for (let j = i + 1; j < contributions.length; j++) {
        scanned++;
        const c1 = contributions[i]!;
        const c2 = contributions[j]!;

        // Quick filter: same employee and payroll date
        if (
          c1.employeeId !== c2.employeeId ||
          c1.payrollDate.getTime() !== c2.payrollDate.getTime()
        ) {
          continue;
        }

        // Calculate match score
        const matchFields: MatchFieldResult[] = [
          {
            fieldName: 'employeeId',
            originalValue: c1.employeeId,
            duplicateValue: c2.employeeId,
            matchType: 'exact',
            similarity: c1.employeeId === c2.employeeId ? 1 : 0,
          },
          {
            fieldName: 'payrollDate',
            originalValue: c1.payrollDate.toISOString(),
            duplicateValue: c2.payrollDate.toISOString(),
            matchType: 'exact',
            similarity: c1.payrollDate.getTime() === c2.payrollDate.getTime() ? 1 : 0,
          },
          {
            fieldName: 'employeePreTax',
            originalValue: c1.employeePreTax,
            duplicateValue: c2.employeePreTax,
            matchType: 'numeric_tolerance',
            similarity: Math.abs(c1.employeePreTax - c2.employeePreTax) <= 1 ? 1 : 0,
          },
        ];

        const score = calculateTotalMatchScore(matchFields, config);

        if (isPotentialDuplicate(score, { ...config, minimumScore: minScore })) {
          found++;

          // Check if already recorded
          const existing = await prisma.deduplicationRecord.findFirst({
            where: {
              organizationId,
              originalRecordId: c1.id,
              duplicateRecordId: c2.id,
              recordType: 'contribution',
            },
          });

          if (existing) {
            existingCount++;
          } else if (!dryRun) {
            await prisma.deduplicationRecord.create({
              data: {
                organizationId,
                originalRecordId: c1.id,
                duplicateRecordId: c2.id,
                recordType: 'contribution',
                matchScore: score,
                matchFields: matchFields as object[],
                status: 'POTENTIAL_DUPLICATE',
              },
            });
            newCount++;
          }
        }
      }
    }

    return { scanned, found, newCount, existingCount };
  }

  private async scanEmployees(
    organizationId: string,
    config: MatchingConfig,
    minScore: number,
    dryRun?: boolean
  ): Promise<{ scanned: number; found: number; newCount: number; existingCount: number }> {
    const employees = await prisma.employee.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    let scanned = 0;
    let found = 0;
    let newCount = 0;
    let existingCount = 0;

    // Compare employees
    for (let i = 0; i < employees.length; i++) {
      for (let j = i + 1; j < employees.length; j++) {
        scanned++;
        const e1 = employees[i]!;
        const e2 = employees[j]!;

        // Calculate match based on SSN and name similarity
        const ssnMatch =
          normalizeSSN(e1.ssnEncrypted) === normalizeSSN(e2.ssnEncrypted) ? 1 : 0;
        const firstNameSim = stringSimilarity(
          normalizeName(e1.firstNameEncrypted),
          normalizeName(e2.firstNameEncrypted)
        );
        const lastNameSim = stringSimilarity(
          normalizeName(e1.lastNameEncrypted),
          normalizeName(e2.lastNameEncrypted)
        );

        const matchFields: MatchFieldResult[] = [
          {
            fieldName: 'ssn',
            originalValue: '[encrypted]',
            duplicateValue: '[encrypted]',
            matchType: 'normalized',
            similarity: ssnMatch,
          },
          {
            fieldName: 'firstName',
            originalValue: '[encrypted]',
            duplicateValue: '[encrypted]',
            matchType: 'fuzzy',
            similarity: firstNameSim,
          },
          {
            fieldName: 'lastName',
            originalValue: '[encrypted]',
            duplicateValue: '[encrypted]',
            matchType: 'fuzzy',
            similarity: lastNameSim,
          },
          {
            fieldName: 'employeeNumber',
            originalValue: e1.employeeNumber,
            duplicateValue: e2.employeeNumber,
            matchType: 'exact',
            similarity: e1.employeeNumber === e2.employeeNumber ? 1 : 0,
          },
        ];

        const score = calculateTotalMatchScore(matchFields, config);

        if (isPotentialDuplicate(score, { ...config, minimumScore: minScore })) {
          found++;

          const existing = await prisma.deduplicationRecord.findFirst({
            where: {
              organizationId,
              originalRecordId: e1.id,
              duplicateRecordId: e2.id,
              recordType: 'employee',
            },
          });

          if (existing) {
            existingCount++;
          } else if (!dryRun) {
            await prisma.deduplicationRecord.create({
              data: {
                organizationId,
                originalRecordId: e1.id,
                duplicateRecordId: e2.id,
                recordType: 'employee',
                matchScore: score,
                matchFields: matchFields as object[],
                status: 'POTENTIAL_DUPLICATE',
              },
            });
            newCount++;
          }
        }
      }
    }

    return { scanned, found, newCount, existingCount };
  }

  private async checkContributionDuplicate(
    organizationId: string,
    data: Record<string, unknown>,
    config: MatchingConfig
  ): Promise<{ isDuplicate: boolean; matchScore?: number; existingRecordId?: string }> {
    const existing = await prisma.contribution.findFirst({
      where: {
        employee: { organizationId },
        employeeId: data.employeeId as string,
        payrollDate: new Date(data.payrollDate as string),
        employeePreTax: data.employeePreTax as number,
        deletedAt: null,
      },
    });

    if (existing) {
      return {
        isDuplicate: true,
        matchScore: 1.0,
        existingRecordId: existing.id,
      };
    }

    return { isDuplicate: false };
  }

  private async checkEmployeeDuplicate(
    organizationId: string,
    data: Record<string, unknown>,
    config: MatchingConfig
  ): Promise<{ isDuplicate: boolean; matchScore?: number; existingRecordId?: string }> {
    // Check for exact SSN match
    const existing = await prisma.employee.findFirst({
      where: {
        organizationId,
        ssnEncrypted: data.ssnEncrypted as string,
        deletedAt: null,
      },
    });

    if (existing) {
      return {
        isDuplicate: true,
        matchScore: 1.0,
        existingRecordId: existing.id,
      };
    }

    return { isDuplicate: false };
  }

  // ============================================
  // Private Helpers
  // ============================================

  private async getRecordPreview(
    recordType: RecordType,
    recordId: string,
    organizationId: string
  ): Promise<RecordPreview> {
    if (recordType === 'contribution') {
      const contribution = await prisma.contribution.findFirst({
        where: { id: recordId, employee: { organizationId } },
        include: { employee: { select: { employeeNumber: true } } },
      });

      return {
        id: recordId,
        type: 'contribution',
        displayName: `Contribution ${contribution?.employee.employeeNumber ?? 'Unknown'}`,
        keyFields: {
          employeeId: contribution?.employeeId,
          payrollDate: contribution?.payrollDate,
          amount:
            (contribution?.employeePreTax ?? 0) +
            (contribution?.employeeRoth ?? 0) +
            (contribution?.employerMatch ?? 0),
        },
        createdAt: contribution?.createdAt ?? new Date(),
      };
    } else if (recordType === 'employee') {
      const employee = await prisma.employee.findFirst({
        where: { id: recordId, organizationId },
      });

      return {
        id: recordId,
        type: 'employee',
        displayName: `Employee ${employee?.employeeNumber ?? 'Unknown'}`,
        keyFields: {
          employeeNumber: employee?.employeeNumber,
          hireDate: employee?.hireDate,
        },
        createdAt: employee?.createdAt ?? new Date(),
      };
    }

    return {
      id: recordId,
      type: recordType,
      displayName: `${recordType} ${recordId}`,
      keyFields: {},
      createdAt: new Date(),
    };
  }

  private formatRecordSummary(record: {
    id: string;
    organizationId: string;
    originalRecordId: string;
    duplicateRecordId: string;
    recordType: string;
    matchScore: number | null;
    matchFields: unknown;
    status: DeduplicationStatus;
    resolvedBy: string | null;
    resolvedAt: Date | null;
    resolutionNotes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): DeduplicationRecordSummary {
    return {
      id: record.id,
      organizationId: record.organizationId,
      originalRecordId: record.originalRecordId,
      duplicateRecordId: record.duplicateRecordId,
      recordType: record.recordType as RecordType,
      matchScore: record.matchScore ?? undefined,
      matchFields: (record.matchFields as MatchFieldResult[]) ?? [],
      status: record.status,
      resolvedBy: record.resolvedBy ?? undefined,
      resolvedAt: record.resolvedAt ?? undefined,
      resolutionNotes: record.resolutionNotes ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
