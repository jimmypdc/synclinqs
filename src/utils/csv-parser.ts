import { logger } from './logger.js';

export interface CsvParseResult<T> {
  success: boolean;
  data: T[];
  errors: CsvParseError[];
  totalRows: number;
  validRows: number;
}

export interface CsvParseError {
  row: number;
  field?: string;
  message: string;
  value?: string;
}

export interface ContributionCsvRow {
  employeeNumber: string;
  payrollDate: string;
  employeePreTax: number;
  employeeRoth: number;
  employerMatch: number;
  employerNonMatch: number;
  loanRepayment: number;
}

const CONTRIBUTION_CSV_HEADERS = [
  'employee_number',
  'payroll_date',
  'employee_pre_tax',
  'employee_roth',
  'employer_match',
  'employer_non_match',
  'loan_repayment',
] as const;

const HEADER_ALIASES: Record<string, string> = {
  'emp_number': 'employee_number',
  'emp_no': 'employee_number',
  'employee_id': 'employee_number',
  'emp_id': 'employee_number',
  'date': 'payroll_date',
  'pay_date': 'payroll_date',
  'pre_tax': 'employee_pre_tax',
  'pretax': 'employee_pre_tax',
  'employee_pretax': 'employee_pre_tax',
  'roth': 'employee_roth',
  'match': 'employer_match',
  'employer_contribution': 'employer_match',
  'non_match': 'employer_non_match',
  'nonmatch': 'employer_non_match',
  'loan': 'loan_repayment',
  'loan_payment': 'loan_repayment',
};

function normalizeHeader(header: string): string {
  const normalized = header.toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_');
  return HEADER_ALIASES[normalized] ?? normalized;
}

function parseAmount(value: string): number {
  if (!value || value.trim() === '') return 0;

  // Remove currency symbols, commas, spaces
  const cleaned = value.replace(/[$,\s]/g, '').trim();

  // Handle parentheses for negative numbers
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    return -Math.round(parseFloat(cleaned.slice(1, -1)) * 100);
  }

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;

  // Convert dollars to cents
  return Math.round(parsed * 100);
}

function parseDate(value: string): string | null {
  if (!value || value.trim() === '') return null;

  const trimmed = value.trim();

  // Try ISO format first (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  // Try MM/DD/YYYY format
  const mdyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, month, day, year] = mdyMatch;
    const date = new Date(parseInt(year!), parseInt(month!) - 1, parseInt(day!));
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  // Try MM-DD-YYYY format
  const mdyDashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (mdyDashMatch) {
    const [, month, day, year] = mdyDashMatch;
    const date = new Date(parseInt(year!), parseInt(month!) - 1, parseInt(day!));
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}

export function parseCsvContent(content: string): CsvParseResult<ContributionCsvRow> {
  const errors: CsvParseError[] = [];
  const data: ContributionCsvRow[] = [];

  // Split into lines and handle different line endings
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

  if (lines.length < 2) {
    return {
      success: false,
      data: [],
      errors: [{ row: 0, message: 'File must contain a header row and at least one data row' }],
      totalRows: 0,
      validRows: 0,
    };
  }

  // Parse header row
  const headerLine = lines[0]!;
  const rawHeaders = parseCSVLine(headerLine);
  const headers = rawHeaders.map(normalizeHeader);

  // Validate required headers
  const requiredHeaders = ['employee_number', 'payroll_date', 'employee_pre_tax'];
  const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

  if (missingHeaders.length > 0) {
    return {
      success: false,
      data: [],
      errors: [{
        row: 1,
        message: `Missing required headers: ${missingHeaders.join(', ')}. Found: ${headers.join(', ')}`
      }],
      totalRows: 0,
      validRows: 0,
    };
  }

  // Create header index map
  const headerIndex: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerIndex[h] = i;
  });

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    const rowNumber = i + 1; // 1-indexed for user display

    try {
      const values = parseCSVLine(line);

      // Get values by header
      const getValue = (header: string): string => {
        const idx = headerIndex[header];
        return idx !== undefined ? (values[idx] ?? '') : '';
      };

      const employeeNumber = getValue('employee_number').trim();
      if (!employeeNumber) {
        errors.push({ row: rowNumber, field: 'employee_number', message: 'Employee number is required' });
        continue;
      }

      const payrollDate = parseDate(getValue('payroll_date'));
      if (!payrollDate) {
        errors.push({
          row: rowNumber,
          field: 'payroll_date',
          message: 'Invalid or missing payroll date',
          value: getValue('payroll_date'),
        });
        continue;
      }

      const employeePreTax = parseAmount(getValue('employee_pre_tax'));
      const employeeRoth = parseAmount(getValue('employee_roth'));
      const employerMatch = parseAmount(getValue('employer_match'));
      const employerNonMatch = parseAmount(getValue('employer_non_match'));
      const loanRepayment = parseAmount(getValue('loan_repayment'));

      // Validate amounts are non-negative
      if (employeePreTax < 0 || employeeRoth < 0 || employerMatch < 0 || employerNonMatch < 0 || loanRepayment < 0) {
        errors.push({ row: rowNumber, message: 'Contribution amounts cannot be negative' });
        continue;
      }

      // Validate at least some contribution exists
      if (employeePreTax === 0 && employeeRoth === 0 && employerMatch === 0 && employerNonMatch === 0) {
        errors.push({ row: rowNumber, message: 'Row has no contribution amounts' });
        continue;
      }

      data.push({
        employeeNumber,
        payrollDate,
        employeePreTax,
        employeeRoth,
        employerMatch,
        employerNonMatch,
        loanRepayment,
      });
    } catch (err) {
      const error = err as Error;
      errors.push({ row: rowNumber, message: `Parse error: ${error.message}` });
    }
  }

  logger.info('CSV parsing completed', {
    totalRows: lines.length - 1,
    validRows: data.length,
    errorCount: errors.length,
  });

  return {
    success: errors.length === 0,
    data,
    errors,
    totalRows: lines.length - 1,
    validRows: data.length,
  };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  result.push(current);
  return result;
}

export function generateSampleCsv(): string {
  return `employee_number,payroll_date,employee_pre_tax,employee_roth,employer_match,employer_non_match,loan_repayment
EMP001,2024-01-15,500.00,0.00,250.00,0.00,0.00
EMP002,2024-01-15,750.00,250.00,500.00,100.00,50.00
EMP003,2024-01-15,1000.00,0.00,500.00,0.00,0.00`;
}
