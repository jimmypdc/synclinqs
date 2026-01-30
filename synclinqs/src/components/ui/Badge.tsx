import { HTMLAttributes } from 'react';
import styles from './Badge.module.css';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = '',
  ...props
}: BadgeProps) {
  return (
    <span
      className={`${styles.badge} ${styles[variant]} ${styles[size]} ${className}`}
      {...props}
    >
      {dot && <span className={styles.dot} />}
      {children}
    </span>
  );
}

// Helper to get badge variant from status
export function getStatusVariant(status: string): BadgeVariant {
  const statusMap: Record<string, BadgeVariant> = {
    ACTIVE: 'success',
    CONFIRMED: 'success',
    SUCCESS: 'success',
    VALIDATED: 'info',
    PENDING: 'warning',
    INACTIVE: 'default',
    TERMINATED: 'error',
    FAILED: 'error',
    ERROR: 'error',
    SUBMITTED: 'info',
  };
  return statusMap[status.toUpperCase()] || 'default';
}
