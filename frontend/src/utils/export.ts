/**
 * Utility functions for exporting data to CSV/PDF
 */

interface ExportColumn<T> {
  header: string;
  accessor: keyof T | ((row: T) => string | number);
}

/**
 * Converts data to CSV format and triggers download
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string
): void {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Build header row
  const headers = columns.map((col) => `"${col.header}"`).join(',');

  // Build data rows
  const rows = data.map((row) => {
    return columns
      .map((col) => {
        let value: string | number;
        if (typeof col.accessor === 'function') {
          value = col.accessor(row);
        } else {
          value = row[col.accessor] as string | number;
        }
        // Handle null/undefined
        if (value === null || value === undefined) {
          return '""';
        }
        // Escape quotes and wrap in quotes
        return `"${String(value).replace(/"/g, '""')}"`;
      })
      .join(',');
  });

  // Combine header and rows
  const csvContent = [headers, ...rows].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}_${formatDateForFilename(new Date())}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format date for filename (YYYY-MM-DD)
 */
function formatDateForFilename(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format cents to dollars for display
 */
export function formatCurrency(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Format date for display
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Export employees data
 */
export function exportEmployees(employees: Array<{
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  ssn?: string;
  hireDate: string | null;
  terminationDate?: string | null;
  status: string;
}>): void {
  const columns = [
    { header: 'Employee Number', accessor: 'employeeNumber' as const },
    { header: 'First Name', accessor: 'firstName' as const },
    { header: 'Last Name', accessor: 'lastName' as const },
    { header: 'Email', accessor: (row: typeof employees[0]) => row.email || '' },
    { header: 'SSN (Last 4)', accessor: (row: typeof employees[0]) => row.ssn ? `***-**-${row.ssn.slice(-4)}` : '' },
    { header: 'Hire Date', accessor: (row: typeof employees[0]) => formatDate(row.hireDate) },
    { header: 'Termination Date', accessor: (row: typeof employees[0]) => formatDate(row.terminationDate || null) },
    { header: 'Status', accessor: 'status' as const },
  ];

  exportToCSV(employees, columns, 'employees');
}

/**
 * Export contributions data
 */
export function exportContributions(contributions: Array<{
  payrollDate: string;
  employee?: { employeeNumber: string; firstName?: string; lastName?: string };
  employeePreTax: number;
  employeeRoth: number;
  employerMatch: number;
  employerNonMatch: number;
  loanRepayment: number;
  status: string;
}>): void {
  const columns = [
    { header: 'Payroll Date', accessor: (row: typeof contributions[0]) => formatDate(row.payrollDate) },
    { header: 'Employee Number', accessor: (row: typeof contributions[0]) => row.employee?.employeeNumber || '' },
    { header: 'Employee Name', accessor: (row: typeof contributions[0]) =>
      row.employee ? `${row.employee.firstName || ''} ${row.employee.lastName || ''}`.trim() : ''
    },
    { header: 'Pre-Tax ($)', accessor: (row: typeof contributions[0]) => formatCurrency(row.employeePreTax) },
    { header: 'Roth ($)', accessor: (row: typeof contributions[0]) => formatCurrency(row.employeeRoth) },
    { header: 'Employer Match ($)', accessor: (row: typeof contributions[0]) => formatCurrency(row.employerMatch) },
    { header: 'Employer Non-Match ($)', accessor: (row: typeof contributions[0]) => formatCurrency(row.employerNonMatch) },
    { header: 'Loan Repayment ($)', accessor: (row: typeof contributions[0]) => formatCurrency(row.loanRepayment) },
    { header: 'Total ($)', accessor: (row: typeof contributions[0]) => formatCurrency(
      row.employeePreTax + row.employeeRoth + row.employerMatch + row.employerNonMatch + row.loanRepayment
    )},
    { header: 'Status', accessor: 'status' as const },
  ];

  exportToCSV(contributions, columns, 'contributions');
}
