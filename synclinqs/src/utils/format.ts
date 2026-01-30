import { format, formatDistanceToNow, parseISO } from 'date-fns';

/**
 * Format cents to USD currency string
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Format a large number with commas
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Format percentage from basis points (e.g., 500 = 5.00%)
 */
export function formatPercent(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2)}%`;
}

/**
 * Format date for display
 */
export function formatDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
  return format(date, 'MMM d, yyyy');
}

/**
 * Format date with time
 */
export function formatDateTime(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
  return format(date, 'MMM d, yyyy h:mm a');
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Get initials from name
 */
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

/**
 * Format employee status for display
 */
export function formatStatus(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}
