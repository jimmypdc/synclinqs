import { TransformationFn, TransformationDefinition } from '../types/mapping.types.js';
import { FieldDataType, TransformationFunctionType } from '@prisma/client';

// ============================================
// String Transformation Functions
// ============================================

export const formatSsn: TransformationFn = (value) => {
  if (value === null || value === undefined) return null;
  const str = String(value).replace(/\D/g, '');
  if (str.length !== 9) return value;
  return `${str.slice(0, 3)}-${str.slice(3, 5)}-${str.slice(5)}`;
};

export const removeDashes: TransformationFn = (value) => {
  if (value === null || value === undefined) return null;
  return String(value).replace(/-/g, '');
};

export const trimWhitespace: TransformationFn = (value) => {
  if (value === null || value === undefined) return null;
  return String(value).trim();
};

export const uppercase: TransformationFn = (value) => {
  if (value === null || value === undefined) return null;
  return String(value).toUpperCase();
};

export const lowercase: TransformationFn = (value) => {
  if (value === null || value === undefined) return null;
  return String(value).toLowerCase();
};

export const titleCase: TransformationFn = (value) => {
  if (value === null || value === undefined) return null;
  return String(value)
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const concatenate: TransformationFn = (value, params) => {
  if (!Array.isArray(value)) return null;
  const separator = (params?.separator as string) ?? ' ';
  return value.filter((v) => v !== null && v !== undefined).join(separator);
};

export const split: TransformationFn = (value, params) => {
  if (value === null || value === undefined) return null;
  const delimiter = (params?.delimiter as string) ?? ' ';
  return String(value).split(delimiter);
};

export const substring: TransformationFn = (value, params) => {
  if (value === null || value === undefined) return null;
  const start = (params?.start as number) ?? 0;
  const end = params?.end as number | undefined;
  return String(value).substring(start, end);
};

export const padLeft: TransformationFn = (value, params) => {
  if (value === null || value === undefined) return null;
  const length = (params?.length as number) ?? 0;
  const char = (params?.char as string) ?? '0';
  return String(value).padStart(length, char);
};

export const padRight: TransformationFn = (value, params) => {
  if (value === null || value === undefined) return null;
  const length = (params?.length as number) ?? 0;
  const char = (params?.char as string) ?? '0';
  return String(value).padEnd(length, char);
};

export const replace: TransformationFn = (value, params) => {
  if (value === null || value === undefined) return null;
  const pattern = params?.pattern as string;
  const replacement = (params?.replacement as string) ?? '';
  const global = (params?.global as boolean) ?? true;

  if (!pattern) return value;

  if (global) {
    return String(value).split(pattern).join(replacement);
  }
  return String(value).replace(pattern, replacement);
};

export const mask: TransformationFn = (value, params) => {
  if (value === null || value === undefined) return null;
  const str = String(value);
  const visibleChars = (params?.visibleChars as number) ?? 4;
  const maskChar = (params?.maskChar as string) ?? '*';
  const position = (params?.position as 'start' | 'end') ?? 'end';

  if (str.length <= visibleChars) return str;

  if (position === 'start') {
    return str.slice(0, visibleChars) + maskChar.repeat(str.length - visibleChars);
  }
  return maskChar.repeat(str.length - visibleChars) + str.slice(-visibleChars);
};

export const extractDigits: TransformationFn = (value) => {
  if (value === null || value === undefined) return null;
  return String(value).replace(/\D/g, '');
};

export const extractLetters: TransformationFn = (value) => {
  if (value === null || value === undefined) return null;
  return String(value).replace(/[^a-zA-Z]/g, '');
};

export const formatPhoneNumber: TransformationFn = (value) => {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return value;
};

export const formatEin: TransformationFn = (value) => {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 9) return value;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
};

// ============================================
// String Transformation Definitions
// ============================================

export const stringTransformationDefinitions: TransformationDefinition[] = [
  {
    name: 'format_ssn',
    displayName: 'Format SSN',
    description: 'Formats a 9-digit SSN with dashes (XXX-XX-XXXX)',
    functionType: TransformationFunctionType.STRING,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
  },
  {
    name: 'remove_dashes',
    displayName: 'Remove Dashes',
    description: 'Removes all dashes from a string',
    functionType: TransformationFunctionType.STRING,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
  },
  {
    name: 'trim_whitespace',
    displayName: 'Trim Whitespace',
    description: 'Removes leading and trailing whitespace',
    functionType: TransformationFunctionType.STRING,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
  },
  {
    name: 'uppercase',
    displayName: 'Uppercase',
    description: 'Converts string to uppercase',
    functionType: TransformationFunctionType.STRING,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
  },
  {
    name: 'lowercase',
    displayName: 'Lowercase',
    description: 'Converts string to lowercase',
    functionType: TransformationFunctionType.STRING,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
  },
  {
    name: 'title_case',
    displayName: 'Title Case',
    description: 'Converts string to title case',
    functionType: TransformationFunctionType.STRING,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
  },
  {
    name: 'concatenate',
    displayName: 'Concatenate',
    description: 'Joins an array of values with a separator',
    functionType: TransformationFunctionType.STRING,
    inputType: FieldDataType.ARRAY,
    outputType: FieldDataType.STRING,
    params: [
      { name: 'separator', type: 'string', required: false, description: 'Separator between values (default: space)' },
    ],
  },
  {
    name: 'split',
    displayName: 'Split',
    description: 'Splits a string by a delimiter',
    functionType: TransformationFunctionType.STRING,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.ARRAY,
    params: [
      { name: 'delimiter', type: 'string', required: false, description: 'Delimiter to split by (default: space)' },
    ],
  },
  {
    name: 'substring',
    displayName: 'Substring',
    description: 'Extracts a portion of a string',
    functionType: TransformationFunctionType.STRING,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
    params: [
      { name: 'start', type: 'number', required: false, description: 'Start index (default: 0)' },
      { name: 'end', type: 'number', required: false, description: 'End index (optional)' },
    ],
  },
  {
    name: 'pad_left',
    displayName: 'Pad Left',
    description: 'Pads string on the left to reach specified length',
    functionType: TransformationFunctionType.STRING,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
    params: [
      { name: 'length', type: 'number', required: true, description: 'Target length' },
      { name: 'char', type: 'string', required: false, description: 'Padding character (default: 0)' },
    ],
  },
  {
    name: 'pad_right',
    displayName: 'Pad Right',
    description: 'Pads string on the right to reach specified length',
    functionType: TransformationFunctionType.STRING,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
    params: [
      { name: 'length', type: 'number', required: true, description: 'Target length' },
      { name: 'char', type: 'string', required: false, description: 'Padding character (default: 0)' },
    ],
  },
  {
    name: 'replace',
    displayName: 'Replace',
    description: 'Replaces occurrences of a pattern',
    functionType: TransformationFunctionType.STRING,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
    params: [
      { name: 'pattern', type: 'string', required: true, description: 'Pattern to replace' },
      { name: 'replacement', type: 'string', required: false, description: 'Replacement string (default: empty)' },
      { name: 'global', type: 'boolean', required: false, description: 'Replace all occurrences (default: true)' },
    ],
  },
  {
    name: 'mask',
    displayName: 'Mask',
    description: 'Masks sensitive data, showing only specified characters',
    functionType: TransformationFunctionType.STRING,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
    params: [
      { name: 'visibleChars', type: 'number', required: false, description: 'Number of visible characters (default: 4)' },
      { name: 'maskChar', type: 'string', required: false, description: 'Masking character (default: *)' },
      { name: 'position', type: 'string', required: false, description: 'Show at start or end (default: end)' },
    ],
  },
  {
    name: 'extract_digits',
    displayName: 'Extract Digits',
    description: 'Extracts only numeric digits from a string',
    functionType: TransformationFunctionType.STRING,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
  },
  {
    name: 'extract_letters',
    displayName: 'Extract Letters',
    description: 'Extracts only letters from a string',
    functionType: TransformationFunctionType.STRING,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
  },
  {
    name: 'format_phone_number',
    displayName: 'Format Phone Number',
    description: 'Formats a phone number in standard US format',
    functionType: TransformationFunctionType.STRING,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
  },
  {
    name: 'format_ein',
    displayName: 'Format EIN',
    description: 'Formats an Employer Identification Number (XX-XXXXXXX)',
    functionType: TransformationFunctionType.STRING,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.STRING,
  },
];

export const stringTransformations: Record<string, TransformationFn> = {
  format_ssn: formatSsn,
  remove_dashes: removeDashes,
  trim_whitespace: trimWhitespace,
  uppercase,
  lowercase,
  title_case: titleCase,
  concatenate,
  split,
  substring,
  pad_left: padLeft,
  pad_right: padRight,
  replace,
  mask,
  extract_digits: extractDigits,
  extract_letters: extractLetters,
  format_phone_number: formatPhoneNumber,
  format_ein: formatEin,
};
