import { TransformationFn, TransformationDefinition } from '../types/mapping.types.js';
import { FieldDataType, TransformationFunctionType } from '@prisma/client';

// ============================================
// Lookup Transformation Functions
// ============================================

export const lookupValue: TransformationFn = (value, params) => {
  if (value === null || value === undefined) return params?.defaultValue ?? null;

  const lookupTable = params?.lookupTable as Record<string, unknown> | undefined;
  if (!lookupTable) return params?.defaultValue ?? null;

  const key = String(value);
  return lookupTable[key] ?? params?.defaultValue ?? null;
};

export const mapCode: TransformationFn = (value, params) => {
  if (value === null || value === undefined) return params?.defaultValue ?? null;

  const mapping = params?.mapping as Record<string, unknown> | undefined;
  if (!mapping) return params?.defaultValue ?? value;

  const key = String(value).toUpperCase();
  return mapping[key] ?? params?.defaultValue ?? value;
};

export const defaultIfNull: TransformationFn = (value, params) => {
  if (value === null || value === undefined) {
    return params?.defaultValue ?? null;
  }
  return value;
};

export const defaultIfEmpty: TransformationFn = (value, params) => {
  if (value === null || value === undefined) {
    return params?.defaultValue ?? null;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return params?.defaultValue ?? null;
  }
  if (Array.isArray(value) && value.length === 0) {
    return params?.defaultValue ?? null;
  }
  return value;
};

export const coalesce: TransformationFn = (value) => {
  if (!Array.isArray(value)) return value;

  for (const item of value) {
    if (item !== null && item !== undefined) {
      if (typeof item === 'string' && item.trim() === '') continue;
      return item;
    }
  }
  return null;
};

export const ifThenElse: TransformationFn = (value, params) => {
  const condition = params?.condition as string | undefined;
  const thenValue = params?.then;
  const elseValue = params?.else;

  if (!condition) return value;

  // Simple condition evaluation
  // Supports: equals, not_equals, greater_than, less_than, contains, starts_with, ends_with
  const operator = params?.operator as string ?? 'equals';
  const compareValue = params?.compareValue;

  let conditionMet = false;

  switch (operator) {
    case 'equals':
      conditionMet = value === compareValue;
      break;
    case 'not_equals':
      conditionMet = value !== compareValue;
      break;
    case 'greater_than':
      conditionMet = Number(value) > Number(compareValue);
      break;
    case 'less_than':
      conditionMet = Number(value) < Number(compareValue);
      break;
    case 'greater_than_or_equals':
      conditionMet = Number(value) >= Number(compareValue);
      break;
    case 'less_than_or_equals':
      conditionMet = Number(value) <= Number(compareValue);
      break;
    case 'contains':
      conditionMet = String(value).includes(String(compareValue));
      break;
    case 'starts_with':
      conditionMet = String(value).startsWith(String(compareValue));
      break;
    case 'ends_with':
      conditionMet = String(value).endsWith(String(compareValue));
      break;
    case 'is_null':
      conditionMet = value === null || value === undefined;
      break;
    case 'is_not_null':
      conditionMet = value !== null && value !== undefined;
      break;
    case 'is_empty':
      conditionMet = value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
      break;
    case 'is_not_empty':
      conditionMet = value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0);
      break;
    default:
      conditionMet = false;
  }

  return conditionMet ? thenValue : elseValue;
};

export const switchCase: TransformationFn = (value, params) => {
  const cases = params?.cases as Record<string, unknown> | undefined;
  const defaultValue = params?.defaultValue;

  if (!cases) return defaultValue ?? value;

  const key = String(value);
  return cases[key] ?? defaultValue ?? value;
};

export const firstNonNull: TransformationFn = (value) => {
  if (!Array.isArray(value)) {
    return value !== null && value !== undefined ? value : null;
  }

  for (const item of value) {
    if (item !== null && item !== undefined) {
      return item;
    }
  }
  return null;
};

export const nvl: TransformationFn = (value, params) => {
  // Oracle-style NVL function
  if (value !== null && value !== undefined) {
    return value;
  }
  return params?.replacement ?? null;
};

export const nvl2: TransformationFn = (value, params) => {
  // Oracle-style NVL2 function
  // If value is not null, return ifNotNull, otherwise return ifNull
  if (value !== null && value !== undefined) {
    return params?.ifNotNull ?? value;
  }
  return params?.ifNull ?? null;
};

export const decode: TransformationFn = (value, params) => {
  // Oracle-style DECODE function
  // pairs: [[searchValue1, result1], [searchValue2, result2], ...]
  const pairs = params?.pairs as [unknown, unknown][] | undefined;
  const defaultValue = params?.defaultValue;

  if (!pairs || !Array.isArray(pairs)) {
    return defaultValue ?? value;
  }

  for (const [searchValue, result] of pairs) {
    if (value === searchValue) {
      return result;
    }
  }

  return defaultValue ?? value;
};

// 401(k) specific lookups
export const mapContributionType: TransformationFn = (value, params) => {
  const mapping = params?.mapping as Record<string, string> ?? {
    'PRE_TAX': '1',
    'PRE-TAX': '1',
    'PRETAX': '1',
    'TRADITIONAL': '1',
    'ROTH': '2',
    'ROTH_401K': '2',
    'AFTER_TAX': '3',
    'AFTER-TAX': '3',
    'AFTERTAX': '3',
    'CATCH_UP': '4',
    'CATCH-UP': '4',
    'CATCHUP': '4',
    'EMPLOYER_MATCH': '5',
    'MATCH': '5',
    'EMPLOYER_NON_MATCH': '6',
    'PROFIT_SHARING': '6',
    'LOAN_REPAYMENT': '7',
    'LOAN': '7',
  };

  const key = String(value).toUpperCase().replace(/[\s-]/g, '_');
  return mapping[key] ?? params?.defaultValue ?? value;
};

export const mapEmployeeStatus: TransformationFn = (value, params) => {
  const mapping = params?.mapping as Record<string, string> ?? {
    'ACTIVE': 'A',
    'A': 'A',
    'TERMINATED': 'T',
    'T': 'T',
    'LEAVE': 'L',
    'ON_LEAVE': 'L',
    'L': 'L',
    'DECEASED': 'D',
    'D': 'D',
    'RETIRED': 'R',
    'R': 'R',
    'SUSPENDED': 'S',
    'S': 'S',
  };

  const key = String(value).toUpperCase().replace(/[\s-]/g, '_');
  return mapping[key] ?? params?.defaultValue ?? value;
};

export const mapPayFrequency: TransformationFn = (value, params) => {
  const mapping = params?.mapping as Record<string, string> ?? {
    'WEEKLY': 'W',
    'W': 'W',
    'BI_WEEKLY': 'B',
    'BIWEEKLY': 'B',
    'B': 'B',
    'SEMI_MONTHLY': 'S',
    'SEMIMONTHLY': 'S',
    'S': 'S',
    'MONTHLY': 'M',
    'M': 'M',
    'QUARTERLY': 'Q',
    'Q': 'Q',
    'ANNUAL': 'A',
    'ANNUALLY': 'A',
    'A': 'A',
  };

  const key = String(value).toUpperCase().replace(/[\s-]/g, '_');
  return mapping[key] ?? params?.defaultValue ?? value;
};

// ============================================
// Lookup Transformation Definitions
// ============================================

export const lookupTransformationDefinitions: TransformationDefinition[] = [
  {
    name: 'lookup_value',
    displayName: 'Lookup Value',
    description: 'Looks up value in a table/map',
    functionType: TransformationFunctionType.LOOKUP,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
    params: [
      { name: 'lookupTable', type: 'object', required: true, description: 'Key-value lookup table' },
      { name: 'defaultValue', type: 'any', required: false, description: 'Default if not found' },
    ],
  },
  {
    name: 'map_code',
    displayName: 'Map Code',
    description: 'Maps one code to another',
    functionType: TransformationFunctionType.LOOKUP,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
    params: [
      { name: 'mapping', type: 'object', required: true, description: 'Code mapping' },
      { name: 'defaultValue', type: 'any', required: false, description: 'Default if not found' },
    ],
  },
  {
    name: 'default_if_null',
    displayName: 'Default If Null',
    description: 'Returns default value if null',
    functionType: TransformationFunctionType.LOOKUP,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
    params: [
      { name: 'defaultValue', type: 'any', required: true, description: 'Default value' },
    ],
  },
  {
    name: 'default_if_empty',
    displayName: 'Default If Empty',
    description: 'Returns default value if null or empty',
    functionType: TransformationFunctionType.LOOKUP,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
    params: [
      { name: 'defaultValue', type: 'any', required: true, description: 'Default value' },
    ],
  },
  {
    name: 'coalesce',
    displayName: 'Coalesce',
    description: 'Returns first non-null, non-empty value from array',
    functionType: TransformationFunctionType.LOOKUP,
    inputType: FieldDataType.ARRAY,
    outputType: FieldDataType.STRING,
  },
  {
    name: 'if_then_else',
    displayName: 'If Then Else',
    description: 'Conditional value based on comparison',
    functionType: TransformationFunctionType.CONDITIONAL,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
    params: [
      { name: 'operator', type: 'string', required: true, description: 'Comparison operator' },
      { name: 'compareValue', type: 'any', required: false, description: 'Value to compare against' },
      { name: 'then', type: 'any', required: true, description: 'Value if condition true' },
      { name: 'else', type: 'any', required: true, description: 'Value if condition false' },
    ],
  },
  {
    name: 'switch_case',
    displayName: 'Switch Case',
    description: 'Switch statement for multiple conditions',
    functionType: TransformationFunctionType.CONDITIONAL,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
    params: [
      { name: 'cases', type: 'object', required: true, description: 'Case-value mapping' },
      { name: 'defaultValue', type: 'any', required: false, description: 'Default value' },
    ],
  },
  {
    name: 'first_non_null',
    displayName: 'First Non-Null',
    description: 'Returns first non-null value from array',
    functionType: TransformationFunctionType.LOOKUP,
    inputType: FieldDataType.ARRAY,
    outputType: FieldDataType.STRING,
  },
  {
    name: 'nvl',
    displayName: 'NVL',
    description: 'Returns replacement if value is null (Oracle-style)',
    functionType: TransformationFunctionType.LOOKUP,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
    params: [
      { name: 'replacement', type: 'any', required: true, description: 'Replacement value' },
    ],
  },
  {
    name: 'nvl2',
    displayName: 'NVL2',
    description: 'Returns different values based on null check (Oracle-style)',
    functionType: TransformationFunctionType.LOOKUP,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
    params: [
      { name: 'ifNotNull', type: 'any', required: true, description: 'Value if not null' },
      { name: 'ifNull', type: 'any', required: true, description: 'Value if null' },
    ],
  },
  {
    name: 'decode',
    displayName: 'Decode',
    description: 'Decodes value using search-result pairs (Oracle-style)',
    functionType: TransformationFunctionType.LOOKUP,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
    params: [
      { name: 'pairs', type: 'array', required: true, description: 'Array of [search, result] pairs' },
      { name: 'defaultValue', type: 'any', required: false, description: 'Default value' },
    ],
  },
  {
    name: 'map_contribution_type',
    displayName: 'Map Contribution Type',
    description: 'Maps contribution type codes for 401(k)',
    functionType: TransformationFunctionType.LOOKUP,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
    params: [
      { name: 'mapping', type: 'object', required: false, description: 'Custom mapping (optional)' },
      { name: 'defaultValue', type: 'any', required: false, description: 'Default value' },
    ],
  },
  {
    name: 'map_employee_status',
    displayName: 'Map Employee Status',
    description: 'Maps employee status codes',
    functionType: TransformationFunctionType.LOOKUP,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
    params: [
      { name: 'mapping', type: 'object', required: false, description: 'Custom mapping (optional)' },
      { name: 'defaultValue', type: 'any', required: false, description: 'Default value' },
    ],
  },
  {
    name: 'map_pay_frequency',
    displayName: 'Map Pay Frequency',
    description: 'Maps pay frequency codes',
    functionType: TransformationFunctionType.LOOKUP,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
    params: [
      { name: 'mapping', type: 'object', required: false, description: 'Custom mapping (optional)' },
      { name: 'defaultValue', type: 'any', required: false, description: 'Default value' },
    ],
  },
];

export const lookupTransformations: Record<string, TransformationFn> = {
  lookup_value: lookupValue,
  map_code: mapCode,
  default_if_null: defaultIfNull,
  default_if_empty: defaultIfEmpty,
  coalesce,
  if_then_else: ifThenElse,
  switch_case: switchCase,
  first_non_null: firstNonNull,
  nvl,
  nvl2,
  decode,
  map_contribution_type: mapContributionType,
  map_employee_status: mapEmployeeStatus,
  map_pay_frequency: mapPayFrequency,
};
