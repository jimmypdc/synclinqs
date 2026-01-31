import { DeduplicationStatus } from '@prisma/client';

// ============================================
// Deduplication Record Types
// ============================================

export interface DeduplicationRecordSummary {
  id: string;
  organizationId: string;
  originalRecordId: string;
  duplicateRecordId: string;
  recordType: RecordType;
  matchScore?: number;
  matchFields: MatchFieldResult[];
  status: DeduplicationStatus;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeduplicationRecordDetail extends DeduplicationRecordSummary {
  originalRecord: RecordPreview;
  duplicateRecord: RecordPreview;
  resolvedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

// ============================================
// Record Type Definitions
// ============================================

export type RecordType = 'contribution' | 'employee' | 'election' | 'loan';

export interface RecordPreview {
  id: string;
  type: RecordType;
  displayName: string;
  keyFields: Record<string, unknown>;
  createdAt: Date;
}

export interface MatchFieldResult {
  fieldName: string;
  originalValue: unknown;
  duplicateValue: unknown;
  matchType: MatchType;
  similarity?: number; // 0-1 for fuzzy matches
}

export type MatchType = 'exact' | 'fuzzy' | 'normalized' | 'phonetic' | 'numeric_tolerance';

// ============================================
// Deduplication Query Types
// ============================================

export interface ListDeduplicationQuery {
  page: number;
  limit: number;
  status?: DeduplicationStatus;
  recordType?: RecordType;
  minMatchScore?: number;
  maxMatchScore?: number;
  startDate?: string;
  endDate?: string;
}

export interface DeduplicationScanOptions {
  recordType: RecordType;
  scope?: 'all' | 'recent' | 'unscanned';
  minMatchScore?: number;
  fields?: string[];
  dryRun?: boolean;
}

// ============================================
// Resolution Types
// ============================================

export interface ResolveDeduplicationInput {
  status: DeduplicationStatus;
  resolutionNotes?: string;
}

export interface MergeRecordsInput {
  keepRecordId: string;
  mergeRecordId: string;
  fieldOverrides?: Record<string, unknown>;
}

export interface MergeResult {
  success: boolean;
  mergedRecordId: string;
  deletedRecordId: string;
  fieldsUpdated: string[];
  relationsUpdated: number;
  errors?: string[];
}

// ============================================
// Statistics Types
// ============================================

export interface DeduplicationStats {
  total: number;
  potentialDuplicates: number;
  confirmedDuplicates: number;
  notDuplicates: number;
  merged: number;
  byRecordType: Record<RecordType, number>;
  averageMatchScore: number;
  lastScanAt?: Date;
  pendingReview: number;
}

export interface ScanResult {
  recordType: RecordType;
  recordsScanned: number;
  potentialDuplicatesFound: number;
  scanDurationMs: number;
  newDuplicates: number;
  existingDuplicates: number;
}

// ============================================
// Matching Configuration
// ============================================

export interface MatchingConfig {
  recordType: RecordType;
  rules: MatchingRule[];
  minimumScore: number;
  blockingFields?: string[]; // Fields that must match exactly to compare
}

export interface MatchingRule {
  field: string;
  matchType: MatchType;
  weight: number; // 0-1, contributes to total score
  threshold?: number; // For fuzzy/numeric matches
  normalizer?: NormalizerType;
}

export type NormalizerType =
  | 'lowercase'
  | 'trim'
  | 'remove_punctuation'
  | 'normalize_phone'
  | 'normalize_ssn'
  | 'normalize_name';

// ============================================
// Default Matching Configurations
// ============================================

export const DEFAULT_CONTRIBUTION_MATCHING: MatchingConfig = {
  recordType: 'contribution',
  rules: [
    { field: 'employeeId', matchType: 'exact', weight: 0.3 },
    { field: 'payrollDate', matchType: 'exact', weight: 0.25 },
    { field: 'employeePreTax', matchType: 'numeric_tolerance', weight: 0.15, threshold: 1 },
    { field: 'employeeRoth', matchType: 'numeric_tolerance', weight: 0.15, threshold: 1 },
    { field: 'employerMatch', matchType: 'numeric_tolerance', weight: 0.15, threshold: 1 },
  ],
  minimumScore: 0.9,
  blockingFields: ['employeeId'],
};

export const DEFAULT_EMPLOYEE_MATCHING: MatchingConfig = {
  recordType: 'employee',
  rules: [
    { field: 'ssn', matchType: 'normalized', weight: 0.4, normalizer: 'normalize_ssn' },
    { field: 'firstName', matchType: 'fuzzy', weight: 0.15, threshold: 0.8 },
    { field: 'lastName', matchType: 'fuzzy', weight: 0.15, threshold: 0.8 },
    { field: 'dateOfBirth', matchType: 'exact', weight: 0.2 },
    { field: 'employeeNumber', matchType: 'exact', weight: 0.1 },
  ],
  minimumScore: 0.85,
  blockingFields: ['organizationId'],
};

// ============================================
// Helper Functions
// ============================================

export function getStatusDisplay(status: DeduplicationStatus): string {
  const displayMap: Record<DeduplicationStatus, string> = {
    POTENTIAL_DUPLICATE: 'Potential Duplicate',
    CONFIRMED_DUPLICATE: 'Confirmed Duplicate',
    NOT_DUPLICATE: 'Not a Duplicate',
    MERGED: 'Merged',
  };
  return displayMap[status];
}

export function getRecordTypeDisplay(recordType: RecordType): string {
  const displayMap: Record<RecordType, string> = {
    contribution: 'Contribution',
    employee: 'Employee',
    election: 'Election',
    loan: 'Loan',
  };
  return displayMap[recordType];
}

export function getMatchTypeDisplay(matchType: MatchType): string {
  const displayMap: Record<MatchType, string> = {
    exact: 'Exact Match',
    fuzzy: 'Fuzzy Match',
    normalized: 'Normalized Match',
    phonetic: 'Phonetic Match',
    numeric_tolerance: 'Numeric (with tolerance)',
  };
  return displayMap[matchType];
}

export function calculateTotalMatchScore(matches: MatchFieldResult[], config: MatchingConfig): number {
  let totalScore = 0;
  let totalWeight = 0;

  for (const match of matches) {
    const rule = config.rules.find(r => r.field === match.fieldName);
    if (rule) {
      const fieldScore = match.similarity ?? (match.matchType === 'exact' ? 1 : 0);
      totalScore += fieldScore * rule.weight;
      totalWeight += rule.weight;
    }
  }

  return totalWeight > 0 ? totalScore / totalWeight : 0;
}

export function isPotentialDuplicate(score: number, config: MatchingConfig): boolean {
  return score >= config.minimumScore;
}

export function getMatchingConfig(recordType: RecordType): MatchingConfig {
  const configs: Record<RecordType, MatchingConfig> = {
    contribution: DEFAULT_CONTRIBUTION_MATCHING,
    employee: DEFAULT_EMPLOYEE_MATCHING,
    election: { ...DEFAULT_CONTRIBUTION_MATCHING, recordType: 'election' },
    loan: { ...DEFAULT_CONTRIBUTION_MATCHING, recordType: 'loan' },
  };
  return configs[recordType];
}

// ============================================
// String Similarity Functions
// ============================================

export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j]! + 1
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}

export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLength = Math.max(a.length, b.length);
  return 1 - distance / maxLength;
}

export function normalizeSSN(ssn: string): string {
  return ssn.replace(/\D/g, '');
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ');
}

// Re-export Prisma enums for convenience
export { DeduplicationStatus };
