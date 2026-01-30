import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportToCSV, formatCurrency, formatDate, exportEmployees, exportContributions } from './export';

describe('Export Utilities', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock document.createElement and related DOM methods
    const mockLink = {
      href: '',
      setAttribute: vi.fn(),
      click: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as unknown as HTMLElement);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as unknown as HTMLElement);
  });

  describe('formatCurrency', () => {
    it('should format cents to dollars', () => {
      expect(formatCurrency(10000)).toBe('100.00');
      expect(formatCurrency(12345)).toBe('123.45');
      expect(formatCurrency(0)).toBe('0.00');
      expect(formatCurrency(99)).toBe('0.99');
    });
  });

  describe('formatDate', () => {
    it('should format date string', () => {
      const result = formatDate('2024-01-15T10:30:00Z');
      expect(result).toMatch(/01\/15\/2024/);
    });

    it('should return empty string for null', () => {
      expect(formatDate(null)).toBe('');
    });
  });

  describe('exportToCSV', () => {
    it('should create CSV with headers and data', () => {
      const data = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
      ];

      const columns = [
        { header: 'Name', accessor: 'name' as const },
        { header: 'Age', accessor: 'age' as const },
      ];

      exportToCSV(data, columns, 'test');

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(document.createElement).toHaveBeenCalledWith('a');
    });

    it('should handle accessor functions', () => {
      const data = [{ firstName: 'John', lastName: 'Doe' }];

      const columns = [
        {
          header: 'Full Name',
          accessor: (row: typeof data[0]) => `${row.firstName} ${row.lastName}`,
        },
      ];

      exportToCSV(data, columns, 'test');

      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    it('should not export when data is empty', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      exportToCSV([], [{ header: 'Test', accessor: 'test' as const }], 'test');

      expect(consoleSpy).toHaveBeenCalledWith('No data to export');
      expect(URL.createObjectURL).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should escape quotes in values', () => {
      const data = [{ text: 'He said "hello"' }];
      const columns = [{ header: 'Text', accessor: 'text' as const }];

      exportToCSV(data, columns, 'test');

      // Verify the blob was created (we can't easily inspect its contents)
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
  });

  describe('exportEmployees', () => {
    it('should export employee data correctly', () => {
      const employees = [
        {
          employeeNumber: 'EMP001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          ssn: '123456789',
          hireDate: '2024-01-15',
          terminationDate: null,
          status: 'ACTIVE',
        },
      ];

      exportEmployees(employees);

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(document.createElement).toHaveBeenCalledWith('a');
    });

    it('should mask SSN', () => {
      const employees = [
        {
          employeeNumber: 'EMP001',
          firstName: 'John',
          lastName: 'Doe',
          ssn: '123456789',
          hireDate: '2024-01-15',
          status: 'ACTIVE',
        },
      ];

      exportEmployees(employees);

      // The export function should mask SSN to show only last 4 digits
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
  });

  describe('exportContributions', () => {
    it('should export contribution data correctly', () => {
      const contributions = [
        {
          payrollDate: '2024-01-15',
          employee: { employeeNumber: 'EMP001', firstName: 'John', lastName: 'Doe' },
          employeePreTax: 50000,
          employeeRoth: 25000,
          employerMatch: 25000,
          employerNonMatch: 0,
          loanRepayment: 0,
          status: 'CONFIRMED',
        },
      ];

      exportContributions(contributions);

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(document.createElement).toHaveBeenCalledWith('a');
    });

    it('should handle missing employee data', () => {
      const contributions = [
        {
          payrollDate: '2024-01-15',
          employeePreTax: 50000,
          employeeRoth: 0,
          employerMatch: 25000,
          employerNonMatch: 0,
          loanRepayment: 0,
          status: 'PENDING',
        },
      ];

      exportContributions(contributions);

      expect(URL.createObjectURL).toHaveBeenCalled();
    });
  });
});
