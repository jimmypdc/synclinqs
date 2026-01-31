import {
  MappingType,
  FieldDataType,
  TransformationFunctionType,
  ValidationRuleType,
  ValidationSeverity,
} from '@prisma/client';

// ============================================
// Mapping Rules Structure (stored as JSONB)
// ============================================

export interface FieldMapping {
  sourceField: string;
  destinationField: string;
  transformation?: string;
  transformationParams?: Record<string, unknown>;
  required: boolean;
}

export interface ConditionalMapping {
  condition: string; // JavaScript expression: "source.contribution_type === 'PRE_TAX'"
  mappings: Array<{
    destinationField: string;
    value: unknown; // Static value or expression
  }>;
}

export interface CalculatedField {
  destinationField: string;
  formula: string; // "source.gross_pay * source.deferral_pct"
  rounding?: 'cents' | 'dollars' | 'none';
}

export interface LookupMapping {
  sourceField: string;
  lookupTable: string | Record<string, unknown>; // Table name or inline map
  lookupKey: string;
  lookupValue: string;
  destinationField: string;
  defaultValue?: unknown;
}

export interface DefaultValue {
  destinationField: string;
  value: unknown;
  applyWhen: 'always' | 'if_null' | 'if_empty';
}

export interface MappingRules {
  fieldMappings: FieldMapping[];
  conditionalMappings?: ConditionalMapping[];
  calculatedFields?: CalculatedField[];
  lookupMappings?: LookupMapping[];
  defaultValues?: DefaultValue[];
}

// ============================================
// Mapping Execution Types
// ============================================

export interface MappingError {
  recordIndex: number;
  field?: string;
  code: string;
  message: string;
  sourceValue?: unknown;
}

export interface MappingWarning {
  recordIndex: number;
  field?: string;
  code: string;
  message: string;
}

export interface MappingMetrics {
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  processingTimeMs: number;
  avgTimePerRecordMs: number;
}

export interface MappingResult {
  success: boolean;
  data: Record<string, unknown>[];
  errors: MappingError[];
  warnings: MappingWarning[];
  metrics: MappingMetrics;
}

export interface MappingTestResult extends MappingResult {
  dryRun: true;
}

// ============================================
// API Request/Response Types
// ============================================

export interface CreateMappingData {
  name: string;
  sourceSystem: string;
  destinationSystem: string;
  mappingType: MappingType;
  mappingRules: MappingRules;
  templateId?: string;
}

export interface UpdateMappingData {
  name?: string;
  mappingRules?: MappingRules;
  isActive?: boolean;
}

export interface ListMappingsQuery {
  page: number;
  limit: number;
  sourceSystem?: string;
  destinationSystem?: string;
  mappingType?: MappingType;
  isActive?: boolean;
}

export interface FormattedMapping {
  id: string;
  name: string;
  sourceSystem: string;
  destinationSystem: string;
  mappingType: MappingType;
  mappingRules: MappingRules;
  isActive: boolean;
  templateId?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

// ============================================
// Field Definition Types
// ============================================

export interface CreateFieldDefinitionData {
  systemName: string;
  fieldName: string;
  displayName: string;
  dataType: FieldDataType;
  formatPattern?: string;
  isRequired?: boolean;
  isPii?: boolean;
  validationRules?: Record<string, unknown>;
  description?: string;
  exampleValue?: string;
}

export interface UpdateFieldDefinitionData {
  displayName?: string;
  formatPattern?: string;
  isRequired?: boolean;
  isPii?: boolean;
  validationRules?: Record<string, unknown>;
  description?: string;
  exampleValue?: string;
}

// ============================================
// Mapping Template Types
// ============================================

export interface CreateTemplateData {
  name: string;
  description?: string;
  sourceSystem: string;
  destinationSystem: string;
  mappingType: MappingType;
  templateRules: MappingRules;
}

export interface UpdateTemplateData {
  name?: string;
  description?: string;
  templateRules?: MappingRules;
  isVerified?: boolean;
}

// ============================================
// Transformation Types
// ============================================

export type TransformationFn = (
  value: unknown,
  params?: Record<string, unknown>
) => unknown;

export interface TransformationDefinition {
  name: string;
  displayName: string;
  description?: string;
  category?: string;
  functionType: TransformationFunctionType;
  inputType: FieldDataType;
  outputType: FieldDataType;
  params?: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }>;
}

export interface TransformationTestResult {
  success: boolean;
  input: unknown;
  output?: unknown;
  error?: string;
}

export interface CreateTransformationData {
  name: string;
  displayName: string;
  description?: string;
  functionType: TransformationFunctionType;
  inputType: FieldDataType;
  outputType: FieldDataType;
  functionCode: string;
  testCases?: Array<{
    input: unknown;
    expectedOutput: unknown;
    params?: Record<string, unknown>;
  }>;
}

// ============================================
// Validation Rule Types
// ============================================

export interface RuleLogic {
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in' | 'matches' | 'not_empty';
  value?: unknown;
  min?: number;
  max?: number;
  pattern?: string;
  values?: unknown[];
}

export interface CreateValidationRuleData {
  name: string;
  ruleType: ValidationRuleType;
  appliesTo: string;
  ruleLogic: RuleLogic;
  errorMessage: string;
  severity?: ValidationSeverity;
  isActive?: boolean;
}

export interface UpdateValidationRuleData {
  name?: string;
  ruleLogic?: RuleLogic;
  errorMessage?: string;
  severity?: ValidationSeverity;
  isActive?: boolean;
}

export interface ListRulesQuery {
  page: number;
  limit: number;
  ruleType?: ValidationRuleType;
  appliesTo?: string;
  isActive?: boolean;
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  value?: unknown;
  severity: ValidationSeverity;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ============================================
// Execution Log Types
// ============================================

export interface ExecutionLogSummary {
  id: string;
  mappingConfigId: string;
  fileUploadId?: string;
  executionStart: Date;
  executionEnd?: Date;
  recordsProcessed: number;
  recordsSuccessful: number;
  recordsFailed: number;
  status: 'running' | 'completed' | 'failed';
}

export interface ExecutionLogDetails extends ExecutionLogSummary {
  errorSummary?: Record<string, number>;
  sampleErrors?: MappingError[];
  performanceMetrics?: {
    avgTimePerRecordMs: number;
    peakMemoryMb?: number;
    totalTimeMs: number;
  };
}

// Re-export Prisma enums for convenience
export {
  MappingType,
  FieldDataType,
  TransformationFunctionType,
  ValidationRuleType,
  ValidationSeverity,
};
