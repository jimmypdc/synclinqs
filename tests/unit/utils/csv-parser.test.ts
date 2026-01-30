import { parseCsvContent, generateSampleCsv } from '../../../src/utils/csv-parser';

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('CSV Parser', () => {
  describe('parseCsvContent', () => {
    it('should parse valid CSV content', () => {
      const csv = `employee_number,payroll_date,employee_pre_tax,employee_roth,employer_match,employer_non_match,loan_repayment
EMP001,2024-01-15,500.00,0.00,250.00,0.00,0.00
EMP002,2024-01-15,750.00,250.00,500.00,100.00,50.00`;

      const result = parseCsvContent(csv);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.totalRows).toBe(2);
      expect(result.validRows).toBe(2);
    });

    it('should convert dollar amounts to cents', () => {
      const csv = `employee_number,payroll_date,employee_pre_tax
EMP001,2024-01-15,500.00`;

      const result = parseCsvContent(csv);

      expect(result.data[0]?.employeePreTax).toBe(50000); // $500.00 = 50000 cents
    });

    it('should handle header aliases', () => {
      const csv = `emp_number,pay_date,pre_tax
EMP001,2024-01-15,500.00`;

      const result = parseCsvContent(csv);

      expect(result.success).toBe(true);
      expect(result.data[0]?.employeeNumber).toBe('EMP001');
      expect(result.data[0]?.employeePreTax).toBe(50000);
    });

    it('should handle MM/DD/YYYY date format', () => {
      const csv = `employee_number,payroll_date,employee_pre_tax
EMP001,01/15/2024,500.00`;

      const result = parseCsvContent(csv);

      expect(result.success).toBe(true);
      expect(result.data[0]?.payrollDate).toContain('2024-01-15');
    });

    it('should report error for missing required headers', () => {
      const csv = `employee_number,some_amount
EMP001,500.00`;

      const result = parseCsvContent(csv);

      expect(result.success).toBe(false);
      expect(result.errors[0]?.message).toContain('Missing required headers');
    });

    it('should report error for missing employee number', () => {
      const csv = `employee_number,payroll_date,employee_pre_tax
,2024-01-15,500.00`;

      const result = parseCsvContent(csv);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.field).toBe('employee_number');
    });

    it('should report error for invalid date', () => {
      const csv = `employee_number,payroll_date,employee_pre_tax
EMP001,invalid-date,500.00`;

      const result = parseCsvContent(csv);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.field).toBe('payroll_date');
    });

    it('should report error for rows with no contribution amounts', () => {
      const csv = `employee_number,payroll_date,employee_pre_tax
EMP001,2024-01-15,0.00`;

      const result = parseCsvContent(csv);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toContain('no contribution amounts');
    });

    it('should handle currency symbols and commas in amounts', () => {
      const csv = `employee_number,payroll_date,employee_pre_tax
EMP001,2024-01-15,"$1,500.00"`;

      const result = parseCsvContent(csv);

      expect(result.success).toBe(true);
      expect(result.data[0]?.employeePreTax).toBe(150000); // $1,500.00 = 150000 cents
    });

    it('should handle quoted fields with commas', () => {
      const csv = `employee_number,payroll_date,employee_pre_tax
"EMP,001",2024-01-15,500.00`;

      const result = parseCsvContent(csv);

      expect(result.success).toBe(true);
      expect(result.data[0]?.employeeNumber).toBe('EMP,001');
    });

    it('should handle empty file', () => {
      const csv = ``;

      const result = parseCsvContent(csv);

      expect(result.success).toBe(false);
      expect(result.errors[0]?.message).toContain('header row');
    });

    it('should handle file with only headers', () => {
      const csv = `employee_number,payroll_date,employee_pre_tax`;

      const result = parseCsvContent(csv);

      expect(result.success).toBe(false);
      expect(result.errors[0]?.message).toContain('at least one data row');
    });

    it('should skip rows with errors but continue processing', () => {
      const csv = `employee_number,payroll_date,employee_pre_tax
EMP001,2024-01-15,500.00
,2024-01-15,500.00
EMP003,2024-01-15,750.00`;

      const result = parseCsvContent(csv);

      expect(result.data).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.totalRows).toBe(3);
      expect(result.validRows).toBe(2);
    });
  });

  describe('generateSampleCsv', () => {
    it('should generate valid sample CSV', () => {
      const sample = generateSampleCsv();
      const result = parseCsvContent(sample);

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
    });
  });
});
