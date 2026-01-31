import { TransformationFn, TransformationDefinition } from '../types/mapping.types.js';
import { FieldDataType, TransformationFunctionType } from '@prisma/client';

// ============================================
// Validation Transformation Functions
// ============================================

export const validateSsn: TransformationFn = (value) => {
  if (value === null || value === undefined) return false;
  const str = String(value).replace(/\D/g, '');
  if (str.length !== 9) return false;

  // SSN cannot start with 000, 666, or 900-999
  const area = parseInt(str.slice(0, 3), 10);
  if (area === 0 || area === 666 || area >= 900) return false;

  // Group number (middle two digits) cannot be 00
  const group = parseInt(str.slice(3, 5), 10);
  if (group === 0) return false;

  // Serial number (last four digits) cannot be 0000
  const serial = parseInt(str.slice(5), 10);
  if (serial === 0) return false;

  return true;
};

export const validateEin: TransformationFn = (value) => {
  if (value === null || value === undefined) return false;
  const str = String(value).replace(/\D/g, '');
  if (str.length !== 9) return false;

  // EIN first two digits must be a valid IRS campus code
  const validPrefixes = [
    '10', '12', '60', '67', '50', '53', '01', '02', '03', '04', '05', '06', '11', '13', '14', '16',
    '21', '22', '23', '25', '34', '51', '52', '54', '55', '56', '57', '58', '59', '65',
    '30', '32', '35', '36', '37', '38', '61', '15', '24',
    '40', '44', '94', '95',
    '80', '90',
    '33', '39', '41', '42', '43', '46', '48', '62', '63', '64', '66', '68', '71', '72', '73', '74',
    '75', '76', '77', '81', '82', '83', '84', '85', '86', '87', '88', '91', '92', '93', '98', '99',
    '20', '26', '27', '45', '46', '47',
  ];
  const prefix = str.slice(0, 2);
  return validPrefixes.includes(prefix);
};

export const validateEmail: TransformationFn = (value) => {
  if (value === null || value === undefined) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(value));
};

export const validatePhone: TransformationFn = (value) => {
  if (value === null || value === undefined) return false;
  const digits = String(value).replace(/\D/g, '');
  // US phone: 10 digits, or 11 starting with 1
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
};

export const validatePositive: TransformationFn = (value) => {
  if (value === null || value === undefined) return false;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  return !isNaN(num) && num > 0;
};

export const validateNonNegative: TransformationFn = (value) => {
  if (value === null || value === undefined) return false;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  return !isNaN(num) && num >= 0;
};

export const validateRange: TransformationFn = (value, params) => {
  if (value === null || value === undefined) return false;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return false;

  const min = params?.min as number | undefined;
  const max = params?.max as number | undefined;

  if (min !== undefined && num < min) return false;
  if (max !== undefined && num > max) return false;
  return true;
};

export const validateNotEmpty: TransformationFn = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

export const validateLength: TransformationFn = (value, params) => {
  if (value === null || value === undefined) return false;
  const str = String(value);
  const min = params?.min as number | undefined;
  const max = params?.max as number | undefined;
  const exact = params?.exact as number | undefined;

  if (exact !== undefined) return str.length === exact;
  if (min !== undefined && str.length < min) return false;
  if (max !== undefined && str.length > max) return false;
  return true;
};

export const validatePattern: TransformationFn = (value, params) => {
  if (value === null || value === undefined) return false;
  const pattern = params?.pattern as string;
  if (!pattern) return false;

  try {
    const regex = new RegExp(pattern);
    return regex.test(String(value));
  } catch {
    return false;
  }
};

export const validateIn: TransformationFn = (value, params) => {
  if (value === null || value === undefined) return false;
  const values = params?.values as unknown[];
  if (!Array.isArray(values)) return false;
  return values.includes(value);
};

export const validateNotIn: TransformationFn = (value, params) => {
  if (value === null || value === undefined) return true; // null/undefined not in any list
  const values = params?.values as unknown[];
  if (!Array.isArray(values)) return true;
  return !values.includes(value);
};

export const validateDate: TransformationFn = (value) => {
  if (value === null || value === undefined) return false;
  if (value instanceof Date) return !isNaN(value.getTime());
  const date = new Date(String(value));
  return !isNaN(date.getTime());
};

export const validateFutureDate: TransformationFn = (value) => {
  if (value === null || value === undefined) return false;
  const date = value instanceof Date ? value : new Date(String(value));
  if (isNaN(date.getTime())) return false;
  return date > new Date();
};

export const validatePastDate: TransformationFn = (value) => {
  if (value === null || value === undefined) return false;
  const date = value instanceof Date ? value : new Date(String(value));
  if (isNaN(date.getTime())) return false;
  return date < new Date();
};

export const validateZipCode: TransformationFn = (value) => {
  if (value === null || value === undefined) return false;
  const str = String(value).replace(/\s/g, '');
  // US ZIP: 5 digits or 5+4
  return /^\d{5}(-\d{4})?$/.test(str);
};

export const validateRoutingNumber: TransformationFn = (value) => {
  if (value === null || value === undefined) return false;
  const str = String(value).replace(/\D/g, '');
  if (str.length !== 9) return false;

  // ABA routing number checksum validation
  const digits = str.split('').map(Number) as [number, number, number, number, number, number, number, number, number];
  const checksum =
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    1 * (digits[2] + digits[5] + digits[8]);

  return checksum % 10 === 0;
};

export const validateAccountNumber: TransformationFn = (value) => {
  if (value === null || value === undefined) return false;
  const str = String(value).replace(/\D/g, '');
  // Bank account numbers are typically 4-17 digits
  return str.length >= 4 && str.length <= 17;
};

// ============================================
// Validation Transformation Definitions
// ============================================

export const validationTransformationDefinitions: TransformationDefinition[] = [
  {
    name: 'validate_ssn',
    displayName: 'Validate SSN',
    description: 'Validates Social Security Number format and rules',
    functionType: TransformationFunctionType.CONDITIONAL,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.BOOLEAN,
  },
  {
    name: 'validate_ein',
    displayName: 'Validate EIN',
    description: 'Validates Employer Identification Number',
    functionType: TransformationFunctionType.CONDITIONAL,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.BOOLEAN,
  },
  {
    name: 'validate_email',
    displayName: 'Validate Email',
    description: 'Validates email address format',
    functionType: TransformationFunctionType.CONDITIONAL,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.BOOLEAN,
  },
  {
    name: 'validate_phone',
    displayName: 'Validate Phone',
    description: 'Validates US phone number format',
    functionType: TransformationFunctionType.CONDITIONAL,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.BOOLEAN,
  },
  {
    name: 'validate_positive',
    displayName: 'Validate Positive',
    description: 'Checks if value is positive number',
    functionType: TransformationFunctionType.CONDITIONAL,
    inputType: FieldDataType.NUMBER,
    outputType: FieldDataType.BOOLEAN,
  },
  {
    name: 'validate_non_negative',
    displayName: 'Validate Non-Negative',
    description: 'Checks if value is zero or positive',
    functionType: TransformationFunctionType.CONDITIONAL,
    inputType: FieldDataType.NUMBER,
    outputType: FieldDataType.BOOLEAN,
  },
  {
    name: 'validate_range',
    displayName: 'Validate Range',
    description: 'Checks if value is within specified range',
    functionType: TransformationFunctionType.CONDITIONAL,
    inputType: FieldDataType.NUMBER,
    outputType: FieldDataType.BOOLEAN,
    params: [
      { name: 'min', type: 'number', required: false, description: 'Minimum value' },
      { name: 'max', type: 'number', required: false, description: 'Maximum value' },
    ],
  },
  {
    name: 'validate_not_empty',
    displayName: 'Validate Not Empty',
    description: 'Checks if value is not empty',
    functionType: TransformationFunctionType.CONDITIONAL,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.BOOLEAN,
  },
  {
    name: 'validate_length',
    displayName: 'Validate Length',
    description: 'Checks if string length meets criteria',
    functionType: TransformationFunctionType.CONDITIONAL,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.BOOLEAN,
    params: [
      { name: 'min', type: 'number', required: false, description: 'Minimum length' },
      { name: 'max', type: 'number', required: false, description: 'Maximum length' },
      { name: 'exact', type: 'number', required: false, description: 'Exact length required' },
    ],
  },
  {
    name: 'validate_pattern',
    displayName: 'Validate Pattern',
    description: 'Checks if value matches regex pattern',
    functionType: TransformationFunctionType.CONDITIONAL,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.BOOLEAN,
    params: [
      { name: 'pattern', type: 'string', required: true, description: 'Regular expression pattern' },
    ],
  },
  {
    name: 'validate_in',
    displayName: 'Validate In List',
    description: 'Checks if value is in allowed list',
    functionType: TransformationFunctionType.CONDITIONAL,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.BOOLEAN,
    params: [
      { name: 'values', type: 'array', required: true, description: 'Allowed values' },
    ],
  },
  {
    name: 'validate_not_in',
    displayName: 'Validate Not In List',
    description: 'Checks if value is not in forbidden list',
    functionType: TransformationFunctionType.CONDITIONAL,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.BOOLEAN,
    params: [
      { name: 'values', type: 'array', required: true, description: 'Forbidden values' },
    ],
  },
  {
    name: 'validate_date',
    displayName: 'Validate Date',
    description: 'Checks if value is a valid date',
    functionType: TransformationFunctionType.CONDITIONAL,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.BOOLEAN,
  },
  {
    name: 'validate_future_date',
    displayName: 'Validate Future Date',
    description: 'Checks if date is in the future',
    functionType: TransformationFunctionType.CONDITIONAL,
    inputType: FieldDataType.DATE,
    outputType: FieldDataType.BOOLEAN,
  },
  {
    name: 'validate_past_date',
    displayName: 'Validate Past Date',
    description: 'Checks if date is in the past',
    functionType: TransformationFunctionType.CONDITIONAL,
    inputType: FieldDataType.DATE,
    outputType: FieldDataType.BOOLEAN,
  },
  {
    name: 'validate_zip_code',
    displayName: 'Validate ZIP Code',
    description: 'Validates US ZIP code format',
    functionType: TransformationFunctionType.CONDITIONAL,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.BOOLEAN,
  },
  {
    name: 'validate_routing_number',
    displayName: 'Validate Routing Number',
    description: 'Validates ABA routing number with checksum',
    functionType: TransformationFunctionType.CONDITIONAL,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.BOOLEAN,
  },
  {
    name: 'validate_account_number',
    displayName: 'Validate Account Number',
    description: 'Validates bank account number format',
    functionType: TransformationFunctionType.CONDITIONAL,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.BOOLEAN,
  },
];

export const validationTransformations: Record<string, TransformationFn> = {
  validate_ssn: validateSsn,
  validate_ein: validateEin,
  validate_email: validateEmail,
  validate_phone: validatePhone,
  validate_positive: validatePositive,
  validate_non_negative: validateNonNegative,
  validate_range: validateRange,
  validate_not_empty: validateNotEmpty,
  validate_length: validateLength,
  validate_pattern: validatePattern,
  validate_in: validateIn,
  validate_not_in: validateNotIn,
  validate_date: validateDate,
  validate_future_date: validateFutureDate,
  validate_past_date: validatePastDate,
  validate_zip_code: validateZipCode,
  validate_routing_number: validateRoutingNumber,
  validate_account_number: validateAccountNumber,
};
