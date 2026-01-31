import {
  ReconciliationStatus,
  ReconciliationMatchStatus,
  ReconciliationResolutionAction,
  MappingType,
} from '@prisma/client';

// ============================================
// Reconciliation Report Types
// ============================================

export interface CreateReconciliationInput {
  sourceSystem: string;
  destinationSystem: string;
  reconciliationType: MappingType;
  reconciliationDate: Date;
}

export interface ReconciliationReportSummary {
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
  totalSourceAmount?: bigint;
  totalDestinationAmount?: bigint;
  varianceAmount?: bigint;
  status: ReconciliationStatus;
  reconciledBy?: string;
  reconciledAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReconciliationReportDetail extends ReconciliationReportSummary {
  items: ReconciliationItemSummary[];
  reconciledByUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

// ============================================
// Reconciliation Item Types
// ============================================

export interface ReconciliationItemSummary {
  id: string;
  reconciliationReportId: string;
  employeeId?: string;
  contributionId?: string;
  matchStatus: ReconciliationMatchStatus;
  sourceRecord?: Record<string, unknown>;
  destinationRecord?: Record<string, unknown>;
  sourceAmount?: bigint;
  destinationAmount?: bigint;
  varianceAmount?: bigint;
  discrepancyReason?: string;
  resolutionAction?: ReconciliationResolutionAction;
  resolutionNotes?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface ReconciliationItemDetail extends ReconciliationItemSummary {
  employee?: {
    id: string;
    employeeNumber: string;
  };
  contribution?: {
    id: string;
    payrollDate: Date;
    employeePreTax: number;
    employeeRoth: number;
    employerMatch: number;
  };
  resolvedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

// ============================================
// Reconciliation Query Types
// ============================================

export interface ListReportsQuery {
  page: number;
  limit: number;
  status?: ReconciliationStatus;
  sourceSystem?: string;
  destinationSystem?: string;
  reconciliationType?: MappingType;
  startDate?: string;
  endDate?: string;
}

export interface ListItemsQuery {
  page: number;
  limit: number;
  matchStatus?: ReconciliationMatchStatus;
  hasDiscrepancy?: boolean;
  resolved?: boolean;
}

// ============================================
// Reconciliation Resolution Types
// ============================================

export interface ResolveItemInput {
  resolutionAction: ReconciliationResolutionAction;
  resolutionNotes?: string;
}

export interface BulkResolveInput {
  itemIds: string[];
  resolutionAction: ReconciliationResolutionAction;
  resolutionNotes?: string;
}

export interface BulkResolveResult {
  resolved: number;
  failed: number;
  errors: Array<{
    itemId: string;
    message: string;
  }>;
}

// ============================================
// Reconciliation Result Types
// ============================================

export interface SourceRecord {
  id: string;
  employeeId: string;
  amount: number;
  date: Date;
  type: string;
  metadata?: Record<string, unknown>;
}

export interface DestinationRecord {
  id: string;
  participantId: string;
  amount: number;
  date: Date;
  type: string;
  metadata?: Record<string, unknown>;
}

export interface MatchResult {
  matched: Array<{
    source: SourceRecord;
    destination: DestinationRecord;
  }>;
  sourceOnly: Array<{
    source: SourceRecord;
    destination: null;
  }>;
  destOnly: Array<{
    source: null;
    destination: DestinationRecord;
  }>;
  amountMismatches: Array<{
    source: SourceRecord;
    destination: DestinationRecord;
    varianceAmount: number;
  }>;
}

export interface ReconciliationResult {
  reportId: string;
  totalRecords: number;
  matchedRecords: number;
  unmatchedSourceRecords: number;
  unmatchedDestinationRecords: number;
  amountDiscrepancies: number;
  totalSourceAmount: number;
  totalDestinationAmount: number;
  varianceAmount: number;
  status: ReconciliationStatus;
}

// ============================================
// Dashboard & Statistics Types
// ============================================

export interface ReconciliationDashboard {
  totalReports: number;
  pendingReports: number;
  reconciled: number;
  withDiscrepancies: number;
  failed: number;
  recentReports: ReconciliationReportSummary[];
  discrepancyTrend: ReconciliationTrend[];
  bySystem: SystemReconciliationStats[];
}

export interface ReconciliationTrend {
  date: string;
  total: number;
  matched: number;
  discrepancies: number;
  varianceAmount: number;
}

export interface SystemReconciliationStats {
  sourceSystem: string;
  destinationSystem: string;
  totalReports: number;
  averageMatchRate: number;
  totalVariance: number;
}

// ============================================
// Tolerance Configuration
// ============================================

export interface ReconciliationTolerance {
  amountToleranceCents: number;
  percentageTolerance: number;
  dateTolerance: number; // days
}

export const DEFAULT_TOLERANCE: ReconciliationTolerance = {
  amountToleranceCents: 100, // $1.00
  percentageTolerance: 0.01, // 1%
  dateTolerance: 1, // 1 day
};

// ============================================
// Helper Functions
// ============================================

export function isWithinTolerance(
  sourceAmount: number,
  destAmount: number,
  tolerance: ReconciliationTolerance = DEFAULT_TOLERANCE
): boolean {
  const absoluteDiff = Math.abs(sourceAmount - destAmount);
  const percentDiff = sourceAmount > 0 ? absoluteDiff / sourceAmount : 0;

  return (
    absoluteDiff <= tolerance.amountToleranceCents ||
    percentDiff <= tolerance.percentageTolerance
  );
}

export function calculateVariance(source: number, dest: number): number {
  return source - dest;
}

export function getMatchStatusDisplay(status: ReconciliationMatchStatus): string {
  const displayMap: Record<ReconciliationMatchStatus, string> = {
    MATCHED: 'Matched',
    SOURCE_ONLY: 'Source Only',
    DESTINATION_ONLY: 'Destination Only',
    AMOUNT_MISMATCH: 'Amount Mismatch',
    DATA_MISMATCH: 'Data Mismatch',
  };
  return displayMap[status];
}

export function getStatusDisplay(status: ReconciliationStatus): string {
  const displayMap: Record<ReconciliationStatus, string> = {
    PENDING: 'Pending',
    IN_PROGRESS: 'In Progress',
    RECONCILED: 'Reconciled',
    DISCREPANCIES_FOUND: 'Discrepancies Found',
    FAILED: 'Failed',
  };
  return displayMap[status];
}

// Re-export Prisma enums for convenience
export {
  ReconciliationStatus,
  ReconciliationMatchStatus,
  ReconciliationResolutionAction,
  MappingType,
};
