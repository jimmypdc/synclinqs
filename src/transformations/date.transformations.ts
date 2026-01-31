import { TransformationFn, TransformationDefinition } from '../types/mapping.types.js';
import { FieldDataType, TransformationFunctionType } from '@prisma/client';

// ============================================
// Date Transformation Functions
// ============================================

const parseToDate = (value: unknown): Date | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;

  const str = String(value).trim();

  // Try ISO format first
  let date = new Date(str);
  if (!isNaN(date.getTime())) return date;

  // Try common US formats
  const usPatterns = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // MM-DD-YYYY
  ];

  for (const pattern of usPatterns) {
    const match = str.match(pattern);
    if (match && match[1] && match[2] && match[3]) {
      const month = match[1];
      const day = match[2];
      const year = match[3];
      date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
      if (!isNaN(date.getTime())) return date;
    }
  }

  // Try YYYYMMDD format
  if (/^\d{8}$/.test(str)) {
    const year = parseInt(str.slice(0, 4));
    const month = parseInt(str.slice(4, 6)) - 1;
    const day = parseInt(str.slice(6, 8));
    date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return date;
  }

  return null;
};

const padZero = (num: number, length: number = 2): string => {
  return String(num).padStart(length, '0');
};

export const formatDateIso: TransformationFn = (value) => {
  const date = parseToDate(value);
  if (!date) return null;
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`;
};

export const formatDateUs: TransformationFn = (value) => {
  const date = parseToDate(value);
  if (!date) return null;
  return `${padZero(date.getMonth() + 1)}/${padZero(date.getDate())}/${date.getFullYear()}`;
};

export const formatDateCustom: TransformationFn = (value, params) => {
  const date = parseToDate(value);
  if (!date) return null;

  const format = (params?.format as string) ?? 'YYYY-MM-DD';

  const tokens: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    YY: String(date.getFullYear()).slice(-2),
    MM: padZero(date.getMonth() + 1),
    M: String(date.getMonth() + 1),
    DD: padZero(date.getDate()),
    D: String(date.getDate()),
    HH: padZero(date.getHours()),
    H: String(date.getHours()),
    mm: padZero(date.getMinutes()),
    m: String(date.getMinutes()),
    ss: padZero(date.getSeconds()),
    s: String(date.getSeconds()),
  };

  let result = format;
  for (const [token, replacement] of Object.entries(tokens)) {
    result = result.replace(new RegExp(token, 'g'), replacement);
  }

  return result;
};

export const parseDate: TransformationFn = (value) => {
  const date = parseToDate(value);
  return date ? date.toISOString() : null;
};

export const addDays: TransformationFn = (value, params) => {
  const date = parseToDate(value);
  if (!date) return null;
  const days = (params?.days as number) ?? 0;
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

export const subtractDays: TransformationFn = (value, params) => {
  const date = parseToDate(value);
  if (!date) return null;
  const days = (params?.days as number) ?? 0;
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
};

export const addMonths: TransformationFn = (value, params) => {
  const date = parseToDate(value);
  if (!date) return null;
  const months = (params?.months as number) ?? 0;
  date.setMonth(date.getMonth() + months);
  return date.toISOString().split('T')[0];
};

export const addYears: TransformationFn = (value, params) => {
  const date = parseToDate(value);
  if (!date) return null;
  const years = (params?.years as number) ?? 0;
  date.setFullYear(date.getFullYear() + years);
  return date.toISOString().split('T')[0];
};

export const startOfMonth: TransformationFn = (value) => {
  const date = parseToDate(value);
  if (!date) return null;
  date.setDate(1);
  return date.toISOString().split('T')[0];
};

export const endOfMonth: TransformationFn = (value) => {
  const date = parseToDate(value);
  if (!date) return null;
  date.setMonth(date.getMonth() + 1);
  date.setDate(0);
  return date.toISOString().split('T')[0];
};

export const startOfYear: TransformationFn = (value) => {
  const date = parseToDate(value);
  if (!date) return null;
  return `${date.getFullYear()}-01-01`;
};

export const endOfYear: TransformationFn = (value) => {
  const date = parseToDate(value);
  if (!date) return null;
  return `${date.getFullYear()}-12-31`;
};

export const getYear: TransformationFn = (value) => {
  const date = parseToDate(value);
  if (!date) return null;
  return date.getFullYear();
};

export const getMonth: TransformationFn = (value) => {
  const date = parseToDate(value);
  if (!date) return null;
  return date.getMonth() + 1; // 1-indexed
};

export const getDay: TransformationFn = (value) => {
  const date = parseToDate(value);
  if (!date) return null;
  return date.getDate();
};

export const getDayOfWeek: TransformationFn = (value) => {
  const date = parseToDate(value);
  if (!date) return null;
  return date.getDay(); // 0 = Sunday
};

export const getQuarter: TransformationFn = (value) => {
  const date = parseToDate(value);
  if (!date) return null;
  return Math.ceil((date.getMonth() + 1) / 3);
};

export const calculateAge: TransformationFn = (value, params) => {
  const birthDate = parseToDate(value);
  if (!birthDate) return null;

  const asOfDate = params?.asOfDate ? parseToDate(params.asOfDate) : new Date();
  if (!asOfDate) return null;

  let age = asOfDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = asOfDate.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && asOfDate.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
};

export const isCatchUpEligible: TransformationFn = (value, params) => {
  // Check if person is 50+ for catch-up contributions
  const age = calculateAge(value, params) as number | null;
  if (age === null) return null;
  const threshold = (params?.threshold as number) ?? 50;
  return age >= threshold;
};

export const dateDiff: TransformationFn = (value, params) => {
  const startDate = parseToDate(value);
  const endDate = params?.endDate ? parseToDate(params.endDate) : new Date();
  if (!startDate || !endDate) return null;

  const unit = (params?.unit as string) ?? 'days';
  const diffMs = endDate.getTime() - startDate.getTime();

  switch (unit) {
    case 'days':
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    case 'weeks':
      return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
    case 'months':
      return (
        (endDate.getFullYear() - startDate.getFullYear()) * 12 +
        (endDate.getMonth() - startDate.getMonth())
      );
    case 'years':
      return endDate.getFullYear() - startDate.getFullYear();
    default:
      return null;
  }
};

export const toTimestamp: TransformationFn = (value) => {
  const date = parseToDate(value);
  if (!date) return null;
  return date.getTime();
};

export const fromTimestamp: TransformationFn = (value) => {
  if (value === null || value === undefined) return null;
  const timestamp = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (isNaN(timestamp)) return null;
  return new Date(timestamp).toISOString();
};

// ============================================
// Date Transformation Definitions
// ============================================

export const dateTransformationDefinitions: TransformationDefinition[] = [
  {
    name: 'format_date_iso',
    displayName: 'Format Date ISO',
    description: 'Formats date as ISO (YYYY-MM-DD)',
    functionType: TransformationFunctionType.DATE,
    inputType: FieldDataType.DATE,
    outputType: FieldDataType.STRING,
  },
  {
    name: 'format_date_us',
    displayName: 'Format Date US',
    description: 'Formats date as US format (MM/DD/YYYY)',
    functionType: TransformationFunctionType.DATE,
    inputType: FieldDataType.DATE,
    outputType: FieldDataType.STRING,
  },
  {
    name: 'format_date_custom',
    displayName: 'Format Date Custom',
    description: 'Formats date using custom pattern',
    functionType: TransformationFunctionType.DATE,
    inputType: FieldDataType.DATE,
    outputType: FieldDataType.STRING,
    params: [
      { name: 'format', type: 'string', required: true, description: 'Format pattern (YYYY, MM, DD, HH, mm, ss)' },
    ],
  },
  {
    name: 'parse_date',
    displayName: 'Parse Date',
    description: 'Parses various date formats to ISO',
    functionType: TransformationFunctionType.DATE,
    inputType: FieldDataType.STRING,
    outputType: FieldDataType.DATE,
  },
  {
    name: 'add_days',
    displayName: 'Add Days',
    description: 'Adds specified number of days',
    functionType: TransformationFunctionType.DATE,
    inputType: FieldDataType.DATE,
    outputType: FieldDataType.DATE,
    params: [
      { name: 'days', type: 'number', required: true, description: 'Number of days to add' },
    ],
  },
  {
    name: 'subtract_days',
    displayName: 'Subtract Days',
    description: 'Subtracts specified number of days',
    functionType: TransformationFunctionType.DATE,
    inputType: FieldDataType.DATE,
    outputType: FieldDataType.DATE,
    params: [
      { name: 'days', type: 'number', required: true, description: 'Number of days to subtract' },
    ],
  },
  {
    name: 'add_months',
    displayName: 'Add Months',
    description: 'Adds specified number of months',
    functionType: TransformationFunctionType.DATE,
    inputType: FieldDataType.DATE,
    outputType: FieldDataType.DATE,
    params: [
      { name: 'months', type: 'number', required: true, description: 'Number of months to add' },
    ],
  },
  {
    name: 'add_years',
    displayName: 'Add Years',
    description: 'Adds specified number of years',
    functionType: TransformationFunctionType.DATE,
    inputType: FieldDataType.DATE,
    outputType: FieldDataType.DATE,
    params: [
      { name: 'years', type: 'number', required: true, description: 'Number of years to add' },
    ],
  },
  {
    name: 'start_of_month',
    displayName: 'Start of Month',
    description: 'Returns first day of the month',
    functionType: TransformationFunctionType.DATE,
    inputType: FieldDataType.DATE,
    outputType: FieldDataType.DATE,
  },
  {
    name: 'end_of_month',
    displayName: 'End of Month',
    description: 'Returns last day of the month',
    functionType: TransformationFunctionType.DATE,
    inputType: FieldDataType.DATE,
    outputType: FieldDataType.DATE,
  },
  {
    name: 'start_of_year',
    displayName: 'Start of Year',
    description: 'Returns first day of the year',
    functionType: TransformationFunctionType.DATE,
    inputType: FieldDataType.DATE,
    outputType: FieldDataType.DATE,
  },
  {
    name: 'end_of_year',
    displayName: 'End of Year',
    description: 'Returns last day of the year',
    functionType: TransformationFunctionType.DATE,
    inputType: FieldDataType.DATE,
    outputType: FieldDataType.DATE,
  },
  {
    name: 'get_year',
    displayName: 'Get Year',
    description: 'Extracts year from date',
    functionType: TransformationFunctionType.DATE,
    inputType: FieldDataType.DATE,
    outputType: FieldDataType.NUMBER,
  },
  {
    name: 'get_month',
    displayName: 'Get Month',
    description: 'Extracts month from date (1-12)',
    functionType: TransformationFunctionType.DATE,
    inputType: FieldDataType.DATE,
    outputType: FieldDataType.NUMBER,
  },
  {
    name: 'get_day',
    displayName: 'Get Day',
    description: 'Extracts day of month from date',
    functionType: TransformationFunctionType.DATE,
    inputType: FieldDataType.DATE,
    outputType: FieldDataType.NUMBER,
  },
  {
    name: 'get_day_of_week',
    displayName: 'Get Day of Week',
    description: 'Returns day of week (0=Sunday)',
    functionType: TransformationFunctionType.DATE,
    inputType: FieldDataType.DATE,
    outputType: FieldDataType.NUMBER,
  },
  {
    name: 'get_quarter',
    displayName: 'Get Quarter',
    description: 'Returns quarter (1-4)',
    functionType: TransformationFunctionType.DATE,
    inputType: FieldDataType.DATE,
    outputType: FieldDataType.NUMBER,
  },
  {
    name: 'calculate_age',
    displayName: 'Calculate Age',
    description: 'Calculates age from birth date',
    functionType: TransformationFunctionType.DATE,
    inputType: FieldDataType.DATE,
    outputType: FieldDataType.NUMBER,
    params: [
      { name: 'asOfDate', type: 'date', required: false, description: 'Calculate age as of this date (default: now)' },
    ],
  },
  {
    name: 'is_catch_up_eligible',
    displayName: 'Is Catch-Up Eligible',
    description: 'Checks if person is 50+ for catch-up contributions',
    functionType: TransformationFunctionType.DATE,
    inputType: FieldDataType.DATE,
    outputType: FieldDataType.BOOLEAN,
    params: [
      { name: 'threshold', type: 'number', required: false, description: 'Age threshold (default: 50)' },
      { name: 'asOfDate', type: 'date', required: false, description: 'Calculate as of this date' },
    ],
  },
  {
    name: 'date_diff',
    displayName: 'Date Difference',
    description: 'Calculates difference between dates',
    functionType: TransformationFunctionType.DATE,
    inputType: FieldDataType.DATE,
    outputType: FieldDataType.NUMBER,
    params: [
      { name: 'endDate', type: 'date', required: false, description: 'End date (default: now)' },
      { name: 'unit', type: 'string', required: false, description: 'Unit: days, weeks, months, years (default: days)' },
    ],
  },
  {
    name: 'to_timestamp',
    displayName: 'To Timestamp',
    description: 'Converts date to Unix timestamp (milliseconds)',
    functionType: TransformationFunctionType.DATE,
    inputType: FieldDataType.DATE,
    outputType: FieldDataType.NUMBER,
  },
  {
    name: 'from_timestamp',
    displayName: 'From Timestamp',
    description: 'Converts Unix timestamp to ISO date',
    functionType: TransformationFunctionType.DATE,
    inputType: FieldDataType.NUMBER,
    outputType: FieldDataType.DATE,
  },
];

export const dateTransformations: Record<string, TransformationFn> = {
  format_date_iso: formatDateIso,
  format_date_us: formatDateUs,
  format_date_custom: formatDateCustom,
  parse_date: parseDate,
  add_days: addDays,
  subtract_days: subtractDays,
  add_months: addMonths,
  add_years: addYears,
  start_of_month: startOfMonth,
  end_of_month: endOfMonth,
  start_of_year: startOfYear,
  end_of_year: endOfYear,
  get_year: getYear,
  get_month: getMonth,
  get_day: getDay,
  get_day_of_week: getDayOfWeek,
  get_quarter: getQuarter,
  calculate_age: calculateAge,
  is_catch_up_eligible: isCatchUpEligible,
  date_diff: dateDiff,
  to_timestamp: toTimestamp,
  from_timestamp: fromTimestamp,
};
