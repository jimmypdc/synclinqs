import { TransformationFn, TransformationDefinition } from '../types/mapping.types.js';
import { FieldDataType, TransformationFunctionType } from '@prisma/client';

// ============================================
// Numeric Transformation Functions
// ============================================

export const convertToCents: TransformationFn = (value) => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return null;
  return Math.round(num * 100);
};

export const convertToDollars: TransformationFn = (value) => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (isNaN(num)) return null;
  return num / 100;
};

export const roundToCents: TransformationFn = (value) => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return null;
  return Math.round(num * 100) / 100;
};

export const convertToDecimal: TransformationFn = (value) => {
  // Convert percentage (5.5) to decimal (0.055)
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return null;
  return num / 100;
};

export const convertFromDecimal: TransformationFn = (value) => {
  // Convert decimal (0.055) to percentage (5.5)
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return null;
  return num * 100;
};

export const convertToBasisPoints: TransformationFn = (value) => {
  // Convert percentage (5.5) to basis points (550)
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return null;
  return Math.round(num * 100);
};

export const convertFromBasisPoints: TransformationFn = (value) => {
  // Convert basis points (550) to percentage (5.5)
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (isNaN(num)) return null;
  return num / 100;
};

export const abs: TransformationFn = (value) => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return null;
  return Math.abs(num);
};

export const round: TransformationFn = (value, params) => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return null;
  const decimals = (params?.decimals as number) ?? 0;
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
};

export const floor: TransformationFn = (value) => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return null;
  return Math.floor(num);
};

export const ceil: TransformationFn = (value) => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return null;
  return Math.ceil(num);
};

export const multiply: TransformationFn = (value, params) => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return null;
  const factor = (params?.factor as number) ?? 1;
  return num * factor;
};

export const divide: TransformationFn = (value, params) => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return null;
  const divisor = (params?.divisor as number) ?? 1;
  if (divisor === 0) return null;
  return num / divisor;
};

export const add: TransformationFn = (value, params) => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return null;
  const addend = (params?.value as number) ?? 0;
  return num + addend;
};

export const subtract: TransformationFn = (value, params) => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return null;
  const subtrahend = (params?.value as number) ?? 0;
  return num - subtrahend;
};

export const clamp: TransformationFn = (value, params) => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return null;
  const min = (params?.min as number) ?? Number.MIN_SAFE_INTEGER;
  const max = (params?.max as number) ?? Number.MAX_SAFE_INTEGER;
  return Math.min(Math.max(num, min), max);
};

export const parseNumber: TransformationFn = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  // Remove common formatting characters
  const cleaned = String(value).replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

export const formatCurrency: TransformationFn = (value, params) => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return null;
  const currency = (params?.currency as string) ?? 'USD';
  const locale = (params?.locale as string) ?? 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(num);
};

export const toInteger: TransformationFn = (value) => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return null;
  return Math.trunc(num);
};

// ============================================
// Numeric Transformation Definitions
// ============================================

export const numericTransformationDefinitions: TransformationDefinition[] = [
  {
    name: 'convert_to_cents',
    displayName: 'Convert to Cents',
    description: 'Converts dollar amount to cents (100.50 → 10050)',
    functionType: TransformationFunctionType.NUMERIC,
    inputType: FieldDataType.NUMBER,
    outputType: FieldDataType.NUMBER,
  },
  {
    name: 'convert_to_dollars',
    displayName: 'Convert to Dollars',
    description: 'Converts cents to dollar amount (10050 → 100.50)',
    functionType: TransformationFunctionType.NUMERIC,
    inputType: FieldDataType.NUMBER,
    outputType: FieldDataType.NUMBER,
  },
  {
    name: 'round_to_cents',
    displayName: 'Round to Cents',
    description: 'Rounds to 2 decimal places (100.555 → 100.56)',
    functionType: TransformationFunctionType.NUMERIC,
    inputType: FieldDataType.NUMBER,
    outputType: FieldDataType.NUMBER,
  },
  {
    name: 'convert_to_decimal',
    displayName: 'Convert to Decimal',
    description: 'Converts percentage to decimal (5.5 → 0.055)',
    functionType: TransformationFunctionType.NUMERIC,
    inputType: FieldDataType.NUMBER,
    outputType: FieldDataType.NUMBER,
  },
  {
    name: 'convert_from_decimal',
    displayName: 'Convert from Decimal',
    description: 'Converts decimal to percentage (0.055 → 5.5)',
    functionType: TransformationFunctionType.NUMERIC,
    inputType: FieldDataType.NUMBER,
    outputType: FieldDataType.NUMBER,
  },
  {
    name: 'convert_to_basis_points',
    displayName: 'Convert to Basis Points',
    description: 'Converts percentage to basis points (5.5 → 550)',
    functionType: TransformationFunctionType.NUMERIC,
    inputType: FieldDataType.NUMBER,
    outputType: FieldDataType.NUMBER,
  },
  {
    name: 'convert_from_basis_points',
    displayName: 'Convert from Basis Points',
    description: 'Converts basis points to percentage (550 → 5.5)',
    functionType: TransformationFunctionType.NUMERIC,
    inputType: FieldDataType.NUMBER,
    outputType: FieldDataType.NUMBER,
  },
  {
    name: 'abs',
    displayName: 'Absolute Value',
    description: 'Returns the absolute value (-100 → 100)',
    functionType: TransformationFunctionType.NUMERIC,
    inputType: FieldDataType.NUMBER,
    outputType: FieldDataType.NUMBER,
  },
  {
    name: 'round',
    displayName: 'Round',
    description: 'Rounds to specified decimal places',
    functionType: TransformationFunctionType.NUMERIC,
    inputType: FieldDataType.NUMBER,
    outputType: FieldDataType.NUMBER,
    params: [
      { name: 'decimals', type: 'number', required: false, description: 'Number of decimal places (default: 0)' },
    ],
  },
  {
    name: 'floor',
    displayName: 'Floor',
    description: 'Rounds down to nearest integer (100.9 → 100)',
    functionType: TransformationFunctionType.NUMERIC,
    inputType: FieldDataType.NUMBER,
    outputType: FieldDataType.NUMBER,
  },
  {
    name: 'ceil',
    displayName: 'Ceiling',
    description: 'Rounds up to nearest integer (100.1 → 101)',
    functionType: TransformationFunctionType.NUMERIC,
    inputType: FieldDataType.NUMBER,
    outputType: FieldDataType.NUMBER,
  },
  {
    name: 'multiply',
    displayName: 'Multiply',
    description: 'Multiplies by a factor',
    functionType: TransformationFunctionType.NUMERIC,
    inputType: FieldDataType.NUMBER,
    outputType: FieldDataType.NUMBER,
    params: [
      { name: 'factor', type: 'number', required: true, description: 'Multiplication factor' },
    ],
  },
  {
    name: 'divide',
    displayName: 'Divide',
    description: 'Divides by a divisor',
    functionType: TransformationFunctionType.NUMERIC,
    inputType: FieldDataType.NUMBER,
    outputType: FieldDataType.NUMBER,
    params: [
      { name: 'divisor', type: 'number', required: true, description: 'Divisor (cannot be 0)' },
    ],
  },
  {
    name: 'add',
    displayName: 'Add',
    description: 'Adds a value',
    functionType: TransformationFunctionType.NUMERIC,
    inputType: FieldDataType.NUMBER,
    outputType: FieldDataType.NUMBER,
    params: [
      { name: 'value', type: 'number', required: true, description: 'Value to add' },
    ],
  },
  {
    name: 'subtract',
    displayName: 'Subtract',
    description: 'Subtracts a value',
    functionType: TransformationFunctionType.NUMERIC,
    inputType: FieldDataType.NUMBER,
    outputType: FieldDataType.NUMBER,
    params: [
      { name: 'value', type: 'number', required: true, description: 'Value to subtract' },
    ],
  },
  {
    name: 'clamp',
    displayName: 'Clamp',
    description: 'Constrains value within a range',
    functionType: TransformationFunctionType.NUMERIC,
    inputType: FieldDataType.NUMBER,
    outputType: FieldDataType.NUMBER,
    params: [
      { name: 'min', type: 'number', required: false, description: 'Minimum value' },
      { name: 'max', type: 'number', required: false, description: 'Maximum value' },
    ],
  },
  {
    name: 'parse_number',
    displayName: 'Parse Number',
    description: 'Parses a string to number, removing formatting',
    functionType: TransformationFunctionType.NUMERIC,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.NUMBER,
  },
  {
    name: 'format_currency',
    displayName: 'Format Currency',
    description: 'Formats number as currency string',
    functionType: TransformationFunctionType.NUMERIC,
    inputType: FieldDataType.NUMBER,
    outputType: FieldDataType.STRING,
    params: [
      { name: 'currency', type: 'string', required: false, description: 'Currency code (default: USD)' },
      { name: 'locale', type: 'string', required: false, description: 'Locale (default: en-US)' },
    ],
  },
  {
    name: 'to_integer',
    displayName: 'To Integer',
    description: 'Truncates decimal portion',
    functionType: TransformationFunctionType.NUMERIC,
    inputType: FieldDataType.NUMBER,
    outputType: FieldDataType.NUMBER,
  },
];

export const numericTransformations: Record<string, TransformationFn> = {
  convert_to_cents: convertToCents,
  convert_to_dollars: convertToDollars,
  round_to_cents: roundToCents,
  convert_to_decimal: convertToDecimal,
  convert_from_decimal: convertFromDecimal,
  convert_to_basis_points: convertToBasisPoints,
  convert_from_basis_points: convertFromBasisPoints,
  abs,
  round,
  floor,
  ceil,
  multiply,
  divide,
  add,
  subtract,
  clamp,
  parse_number: parseNumber,
  format_currency: formatCurrency,
  to_integer: toInteger,
};
