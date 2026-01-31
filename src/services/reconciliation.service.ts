import { prisma } from '../lib/prisma.js';
import { createError } from '../api/middleware/errorHandler.js';
import { AuditService } from './audit.service.js';
import {
  ReconciliationStatus,
  ReconciliationMatchStatus,
  ReconciliationResolutionAction,
  MappingType,
} from '@prisma/client';
import {
  CreateReconciliationInput,
  ReconciliationReportSummary,
  ReconciliationReportDetail,
  ReconciliationItemSummary,
  ListReportsQuery,
  ListItemsQuery,
  ResolveItemInput,
  BulkResolveInput,
  BulkResolveResult,
  MatchResult,
  SourceRecord,
  DestinationRecord,
  ReconciliationResult,
  ReconciliationDashboard,
  ReconciliationTolerance,
  DEFAULT_TOLERANCE,
  isWithinTolerance,
} from '../types/reconciliation.types.js';
import { logger } from '../utils/logger.js';

export class ReconciliationService {
  private auditService = new AuditService();

  /**
   * Trigger a new reconciliation run
   */
  async performReconciliation(
    organizationId: string,
    input: CreateReconciliationInput,
    userId: string,
    tolerance: ReconciliationTolerance = DEFAULT_TOLERANCE
  ): Promise<ReconciliationResult> {
    const { sourceSystem, destinationSystem, reconciliationType, reconciliationDate } = input;

    logger.info('Starting reconciliation', {
      organizationId,
      sourceSystem,
      destinationSystem,
      reconciliationType,
      reconciliationDate,
    });

    // Check for existing report for this date/systems
    const existingReport = await prisma.reconciliationReport.findFirst({
      where: {
        organizationId,
        reconciliationDate,
        sourceSystem,
        destinationSystem,
        reconciliationType,
      },
    });

    if (existingReport && existingReport.status !== 'FAILED') {
      throw createError(
        'Reconciliation report already exists for this date and systems',
        400,
        'RECONCILIATION_EXISTS'
      );
    }

    // Create or update report
    const report = existingReport
      ? await prisma.reconciliationReport.update({
          where: { id: existingReport.id },
          data: {
            status: 'IN_PROGRESS',
            matchedRecords: 0,
            unmatchedSourceRecords: 0,
            unmatchedDestinationRecords: 0,
            amountDiscrepancies: 0,
            totalSourceAmount: null,
            totalDestinationAmount: null,
            varianceAmount: null,
            notes: null,
          },
        })
      : await prisma.reconciliationReport.create({
          data: {
            organizationId,
            reconciliationDate,
            sourceSystem,
            destinationSystem,
            reconciliationType,
            totalRecords: 0,
            status: 'IN_PROGRESS',
          },
        });

    try {
      // Fetch source records (contributions sent)
      const sourceRecords = await this.fetchSourceRecords(
        organizationId,
        reconciliationDate,
        reconciliationType
      );

      // Fetch destination records (acknowledgments received)
      const destinationRecords = await this.fetchDestinationRecords(
        organizationId,
        reconciliationDate,
        sourceSystem,
        destinationSystem
      );

      // Perform matching
      const matchResult = this.matchRecords(sourceRecords, destinationRecords, tolerance);

      // Calculate totals
      const totalSourceAmount = sourceRecords.reduce((sum, r) => sum + r.amount, 0);
      const totalDestAmount = destinationRecords.reduce((sum, r) => sum + r.amount, 0);
      const varianceAmount = totalSourceAmount - totalDestAmount;

      // Delete old items if re-running
      if (existingReport) {
        await prisma.reconciliationItem.deleteMany({
          where: { reconciliationReportId: existingReport.id },
        });
      }

      // Create reconciliation items
      await this.createReconciliationItems(report.id, matchResult);

      // Determine final status
      const hasDiscrepancies =
        matchResult.sourceOnly.length > 0 ||
        matchResult.destOnly.length > 0 ||
        matchResult.amountMismatches.length > 0;

      const finalStatus: ReconciliationStatus = hasDiscrepancies
        ? 'DISCREPANCIES_FOUND'
        : 'RECONCILED';

      // Update report with results
      const updatedReport = await prisma.reconciliationReport.update({
        where: { id: report.id },
        data: {
          totalRecords: sourceRecords.length + destinationRecords.length,
          matchedRecords: matchResult.matched.length,
          unmatchedSourceRecords: matchResult.sourceOnly.length,
          unmatchedDestinationRecords: matchResult.destOnly.length,
          amountDiscrepancies: matchResult.amountMismatches.length,
          totalSourceAmount: BigInt(Math.round(totalSourceAmount)),
          totalDestinationAmount: BigInt(Math.round(totalDestAmount)),
          varianceAmount: BigInt(Math.round(varianceAmount)),
          status: finalStatus,
        },
      });

      await this.auditService.log({
        organizationId,
        userId,
        action: 'RECONCILIATION_COMPLETED',
        entityType: 'ReconciliationReport',
        entityId: report.id,
        newValues: {
          status: finalStatus,
          totalRecords: updatedReport.totalRecords,
          matchedRecords: updatedReport.matchedRecords,
          discrepancies:
            matchResult.sourceOnly.length +
            matchResult.destOnly.length +
            matchResult.amountMismatches.length,
        },
      });

      logger.info('Reconciliation completed', {
        reportId: report.id,
        status: finalStatus,
        matched: matchResult.matched.length,
        discrepancies:
          matchResult.sourceOnly.length +
          matchResult.destOnly.length +
          matchResult.amountMismatches.length,
      });

      return {
        reportId: report.id,
        totalRecords: updatedReport.totalRecords,
        matchedRecords: updatedReport.matchedRecords,
        unmatchedSourceRecords: updatedReport.unmatchedSourceRecords,
        unmatchedDestinationRecords: updatedReport.unmatchedDestinationRecords,
        amountDiscrepancies: updatedReport.amountDiscrepancies,
        totalSourceAmount,
        totalDestinationAmount: totalDestAmount,
        varianceAmount,
        status: finalStatus,
      };
    } catch (error) {
      // Update report as failed
      await prisma.reconciliationReport.update({
        where: { id: report.id },
        data: {
          status: 'FAILED',
          notes: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      logger.error('Reconciliation failed', {
        reportId: report.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * List reconciliation reports
   */
  async listReports(
    organizationId: string,
    query: ListReportsQuery
  ): Promise<{
    data: ReconciliationReportSummary[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where: Record<string, unknown> = { organizationId };

    if (query.status) where.status = query.status;
    if (query.sourceSystem) where.sourceSystem = query.sourceSystem;
    if (query.destinationSystem) where.destinationSystem = query.destinationSystem;
    if (query.reconciliationType) where.reconciliationType = query.reconciliationType;
    if (query.startDate || query.endDate) {
      where.reconciliationDate = {};
      if (query.startDate)
        (where.reconciliationDate as Record<string, Date>).gte = new Date(query.startDate);
      if (query.endDate)
        (where.reconciliationDate as Record<string, Date>).lte = new Date(query.endDate);
    }

    const [reports, total] = await Promise.all([
      prisma.reconciliationReport.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { reconciliationDate: 'desc' },
      }),
      prisma.reconciliationReport.count({ where }),
    ]);

    return {
      data: reports.map((r) => this.formatReportSummary(r)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * Get report by ID
   */
  async getReportById(id: string, organizationId: string): Promise<ReconciliationReportDetail> {
    const report = await prisma.reconciliationReport.findFirst({
      where: { id, organizationId },
      include: {
        reconciledByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        items: {
          take: 100,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!report) {
      throw createError('Reconciliation report not found', 404, 'NOT_FOUND');
    }

    return {
      ...this.formatReportSummary(report),
      items: report.items.map((i) => this.formatItemSummary(i)),
      reconciledByUser: report.reconciledByUser ?? undefined,
    };
  }

  /**
   * List items for a report
   */
  async listItems(
    reportId: string,
    organizationId: string,
    query: ListItemsQuery
  ): Promise<{
    data: ReconciliationItemSummary[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    // Verify report belongs to organization
    const report = await prisma.reconciliationReport.findFirst({
      where: { id: reportId, organizationId },
    });

    if (!report) {
      throw createError('Reconciliation report not found', 404, 'NOT_FOUND');
    }

    const where: Record<string, unknown> = { reconciliationReportId: reportId };

    if (query.matchStatus) where.matchStatus = query.matchStatus;
    if (query.hasDiscrepancy) {
      where.matchStatus = {
        in: ['SOURCE_ONLY', 'DESTINATION_ONLY', 'AMOUNT_MISMATCH', 'DATA_MISMATCH'],
      };
    }
    if (query.resolved !== undefined) {
      where.resolvedAt = query.resolved ? { not: null } : null;
    }

    const [items, total] = await Promise.all([
      prisma.reconciliationItem.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.reconciliationItem.count({ where }),
    ]);

    return {
      data: items.map((i) => this.formatItemSummary(i)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * Resolve a single item
   */
  async resolveItem(
    itemId: string,
    organizationId: string,
    input: ResolveItemInput,
    userId: string
  ): Promise<ReconciliationItemSummary> {
    const item = await prisma.reconciliationItem.findFirst({
      where: { id: itemId },
      include: {
        reconciliationReport: { select: { organizationId: true } },
      },
    });

    if (!item || item.reconciliationReport.organizationId !== organizationId) {
      throw createError('Reconciliation item not found', 404, 'NOT_FOUND');
    }

    const updated = await prisma.reconciliationItem.update({
      where: { id: itemId },
      data: {
        resolutionAction: input.resolutionAction,
        resolutionNotes: input.resolutionNotes,
        resolvedBy: userId,
        resolvedAt: new Date(),
      },
    });

    await this.auditService.log({
      organizationId,
      userId,
      action: 'RESOLVE_RECONCILIATION_ITEM',
      entityType: 'ReconciliationItem',
      entityId: itemId,
      newValues: {
        resolutionAction: input.resolutionAction,
        resolutionNotes: input.resolutionNotes,
      },
    });

    // Check if all items are resolved
    await this.checkAndUpdateReportStatus(item.reconciliationReportId, userId);

    return this.formatItemSummary(updated);
  }

  /**
   * Bulk resolve items
   */
  async bulkResolve(
    organizationId: string,
    input: BulkResolveInput,
    userId: string
  ): Promise<BulkResolveResult> {
    const result: BulkResolveResult = {
      resolved: 0,
      failed: 0,
      errors: [],
    };

    for (const itemId of input.itemIds) {
      try {
        await this.resolveItem(
          itemId,
          organizationId,
          {
            resolutionAction: input.resolutionAction,
            resolutionNotes: input.resolutionNotes,
          },
          userId
        );
        result.resolved++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          itemId,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Get dashboard metrics
   */
  async getDashboard(organizationId: string): Promise<ReconciliationDashboard> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalReports,
      pendingReports,
      reconciled,
      withDiscrepancies,
      failed,
      recentReports,
      systemStats,
    ] = await Promise.all([
      prisma.reconciliationReport.count({ where: { organizationId } }),
      prisma.reconciliationReport.count({
        where: { organizationId, status: 'PENDING' },
      }),
      prisma.reconciliationReport.count({
        where: { organizationId, status: 'RECONCILED' },
      }),
      prisma.reconciliationReport.count({
        where: { organizationId, status: 'DISCREPANCIES_FOUND' },
      }),
      prisma.reconciliationReport.count({
        where: { organizationId, status: 'FAILED' },
      }),
      prisma.reconciliationReport.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.reconciliationReport.groupBy({
        by: ['sourceSystem', 'destinationSystem'],
        where: { organizationId },
        _count: true,
        _avg: { matchedRecords: true },
      }),
    ]);

    // Get discrepancy trend for last 30 days
    const trendData = await prisma.reconciliationReport.findMany({
      where: {
        organizationId,
        reconciliationDate: { gte: thirtyDaysAgo },
      },
      select: {
        reconciliationDate: true,
        totalRecords: true,
        matchedRecords: true,
        unmatchedSourceRecords: true,
        unmatchedDestinationRecords: true,
        amountDiscrepancies: true,
        varianceAmount: true,
      },
      orderBy: { reconciliationDate: 'asc' },
    });

    const discrepancyTrend = trendData.map((d) => ({
      date: d.reconciliationDate.toISOString().split('T')[0]!,
      total: d.totalRecords,
      matched: d.matchedRecords,
      discrepancies:
        d.unmatchedSourceRecords + d.unmatchedDestinationRecords + d.amountDiscrepancies,
      varianceAmount: Number(d.varianceAmount ?? 0),
    }));

    const bySystem = systemStats.map((s) => ({
      sourceSystem: s.sourceSystem,
      destinationSystem: s.destinationSystem,
      totalReports: s._count,
      averageMatchRate: s._avg.matchedRecords ?? 0,
      totalVariance: 0, // Would need additional aggregation
    }));

    return {
      totalReports,
      pendingReports,
      reconciled,
      withDiscrepancies,
      failed,
      recentReports: recentReports.map((r) => this.formatReportSummary(r)),
      discrepancyTrend,
      bySystem,
    };
  }

  // Private helper methods

  private async fetchSourceRecords(
    organizationId: string,
    date: Date,
    recordType: MappingType
  ): Promise<SourceRecord[]> {
    // Fetch contributions for the given date
    if (recordType === 'CONTRIBUTION') {
      const contributions = await prisma.contribution.findMany({
        where: {
          employee: { organizationId },
          payrollDate: date,
          status: { in: ['SUBMITTED', 'CONFIRMED'] },
          deletedAt: null,
        },
        include: {
          employee: { select: { id: true, employeeNumber: true } },
        },
      });

      return contributions.map((c) => ({
        id: c.id,
        employeeId: c.employeeId,
        amount: c.employeePreTax + c.employeeRoth + c.employerMatch + c.employerNonMatch,
        date: c.payrollDate,
        type: 'contribution',
        metadata: {
          employeeNumber: c.employee.employeeNumber,
          preTax: c.employeePreTax,
          roth: c.employeeRoth,
          match: c.employerMatch,
          nonMatch: c.employerNonMatch,
        },
      }));
    }

    // Add other record types as needed
    return [];
  }

  private async fetchDestinationRecords(
    organizationId: string,
    date: Date,
    sourceSystem: string,
    destSystem: string
  ): Promise<DestinationRecord[]> {
    // In a real implementation, this would fetch acknowledgment records
    // from file uploads or API responses from the recordkeeper
    // For now, return empty array - would be populated from actual integration data
    logger.debug('Fetching destination records', {
      organizationId,
      date,
      sourceSystem,
      destSystem,
    });

    return [];
  }

  private matchRecords(
    source: SourceRecord[],
    destination: DestinationRecord[],
    tolerance: ReconciliationTolerance
  ): MatchResult {
    const matched: MatchResult['matched'] = [];
    const sourceOnly: MatchResult['sourceOnly'] = [];
    const destOnly: MatchResult['destOnly'] = [];
    const amountMismatches: MatchResult['amountMismatches'] = [];

    const sourceMap = new Map<string, SourceRecord>();
    const destMap = new Map<string, DestinationRecord>();

    // Index by employee ID
    for (const record of source) {
      sourceMap.set(record.employeeId, record);
    }
    for (const record of destination) {
      destMap.set(record.participantId, record);
    }

    // Find matches and mismatches
    for (const [employeeId, sourceRecord] of sourceMap) {
      const destRecord = destMap.get(employeeId);

      if (!destRecord) {
        sourceOnly.push({ source: sourceRecord, destination: null });
      } else if (!isWithinTolerance(sourceRecord.amount, destRecord.amount, tolerance)) {
        amountMismatches.push({
          source: sourceRecord,
          destination: destRecord,
          varianceAmount: sourceRecord.amount - destRecord.amount,
        });
      } else {
        matched.push({ source: sourceRecord, destination: destRecord });
      }

      destMap.delete(employeeId);
    }

    // Remaining destination records are destination-only
    for (const [, destRecord] of destMap) {
      destOnly.push({ source: null, destination: destRecord });
    }

    return { matched, sourceOnly, destOnly, amountMismatches };
  }

  private async createReconciliationItems(
    reportId: string,
    matchResult: MatchResult
  ): Promise<void> {
    const items: Array<{
      reconciliationReportId: string;
      employeeId?: string;
      contributionId?: string;
      matchStatus: ReconciliationMatchStatus;
      sourceRecord?: object;
      destinationRecord?: object;
      sourceAmount?: bigint;
      destinationAmount?: bigint;
      varianceAmount?: bigint;
      discrepancyReason?: string;
    }> = [];

    // Matched records
    for (const { source, destination } of matchResult.matched) {
      items.push({
        reconciliationReportId: reportId,
        employeeId: source.employeeId,
        contributionId: source.id,
        matchStatus: 'MATCHED',
        sourceRecord: source as unknown as object,
        destinationRecord: destination as unknown as object,
        sourceAmount: BigInt(Math.round(source.amount)),
        destinationAmount: BigInt(Math.round(destination.amount)),
        varianceAmount: BigInt(0),
      });
    }

    // Source only
    for (const { source } of matchResult.sourceOnly) {
      items.push({
        reconciliationReportId: reportId,
        employeeId: source.employeeId,
        contributionId: source.id,
        matchStatus: 'SOURCE_ONLY',
        sourceRecord: source as unknown as object,
        sourceAmount: BigInt(Math.round(source.amount)),
        discrepancyReason: 'Record exists in source but not in destination',
      });
    }

    // Destination only
    for (const { destination } of matchResult.destOnly) {
      items.push({
        reconciliationReportId: reportId,
        matchStatus: 'DESTINATION_ONLY',
        destinationRecord: destination as unknown as object,
        destinationAmount: BigInt(Math.round(destination.amount)),
        discrepancyReason: 'Record exists in destination but not in source',
      });
    }

    // Amount mismatches
    for (const { source, destination, varianceAmount } of matchResult.amountMismatches) {
      items.push({
        reconciliationReportId: reportId,
        employeeId: source.employeeId,
        contributionId: source.id,
        matchStatus: 'AMOUNT_MISMATCH',
        sourceRecord: source as unknown as object,
        destinationRecord: destination as unknown as object,
        sourceAmount: BigInt(Math.round(source.amount)),
        destinationAmount: BigInt(Math.round(destination.amount)),
        varianceAmount: BigInt(Math.round(varianceAmount)),
        discrepancyReason: `Amount variance: ${varianceAmount} cents`,
      });
    }

    // Batch create items
    if (items.length > 0) {
      await prisma.reconciliationItem.createMany({
        data: items,
      });
    }
  }

  private async checkAndUpdateReportStatus(
    reportId: string,
    userId: string
  ): Promise<void> {
    const unresolvedCount = await prisma.reconciliationItem.count({
      where: {
        reconciliationReportId: reportId,
        matchStatus: { not: 'MATCHED' },
        resolvedAt: null,
      },
    });

    if (unresolvedCount === 0) {
      await prisma.reconciliationReport.update({
        where: { id: reportId },
        data: {
          status: 'RECONCILED',
          reconciledBy: userId,
          reconciledAt: new Date(),
        },
      });
    }
  }

  private formatReportSummary(report: {
    id: string;
    organizationId: string;
    reconciliationDate: Date;
    sourceSystem: string;
    destinationSystem: string;
    reconciliationType: MappingType;
    totalRecords: number;
    matchedRecords: number;
    unmatchedSourceRecords: number;
    unmatchedDestinationRecords: number;
    amountDiscrepancies: number;
    totalSourceAmount: bigint | null;
    totalDestinationAmount: bigint | null;
    varianceAmount: bigint | null;
    status: ReconciliationStatus;
    reconciledBy: string | null;
    reconciledAt: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ReconciliationReportSummary {
    return {
      id: report.id,
      organizationId: report.organizationId,
      reconciliationDate: report.reconciliationDate,
      sourceSystem: report.sourceSystem,
      destinationSystem: report.destinationSystem,
      reconciliationType: report.reconciliationType,
      totalRecords: report.totalRecords,
      matchedRecords: report.matchedRecords,
      unmatchedSourceRecords: report.unmatchedSourceRecords,
      unmatchedDestinationRecords: report.unmatchedDestinationRecords,
      amountDiscrepancies: report.amountDiscrepancies,
      totalSourceAmount: report.totalSourceAmount ?? undefined,
      totalDestinationAmount: report.totalDestinationAmount ?? undefined,
      varianceAmount: report.varianceAmount ?? undefined,
      status: report.status,
      reconciledBy: report.reconciledBy ?? undefined,
      reconciledAt: report.reconciledAt ?? undefined,
      notes: report.notes ?? undefined,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };
  }

  private formatItemSummary(item: {
    id: string;
    reconciliationReportId: string;
    employeeId: string | null;
    contributionId: string | null;
    matchStatus: ReconciliationMatchStatus;
    sourceRecord: unknown;
    destinationRecord: unknown;
    sourceAmount: bigint | null;
    destinationAmount: bigint | null;
    varianceAmount: bigint | null;
    discrepancyReason: string | null;
    resolutionAction: ReconciliationResolutionAction | null;
    resolutionNotes: string | null;
    resolvedBy: string | null;
    resolvedAt: Date | null;
    createdAt: Date;
  }): ReconciliationItemSummary {
    return {
      id: item.id,
      reconciliationReportId: item.reconciliationReportId,
      employeeId: item.employeeId ?? undefined,
      contributionId: item.contributionId ?? undefined,
      matchStatus: item.matchStatus,
      sourceRecord: item.sourceRecord as Record<string, unknown> | undefined,
      destinationRecord: item.destinationRecord as Record<string, unknown> | undefined,
      sourceAmount: item.sourceAmount ?? undefined,
      destinationAmount: item.destinationAmount ?? undefined,
      varianceAmount: item.varianceAmount ?? undefined,
      discrepancyReason: item.discrepancyReason ?? undefined,
      resolutionAction: item.resolutionAction ?? undefined,
      resolutionNotes: item.resolutionNotes ?? undefined,
      resolvedBy: item.resolvedBy ?? undefined,
      resolvedAt: item.resolvedAt ?? undefined,
      createdAt: item.createdAt,
    };
  }
}
