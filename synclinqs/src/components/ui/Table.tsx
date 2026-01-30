import { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import styles from './Table.module.css';

interface TableProps extends HTMLAttributes<HTMLTableElement> {}

export function Table({ children, className = '', ...props }: TableProps) {
  return (
    <div className={styles.wrapper}>
      <table className={`${styles.table} ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

interface TableHeadProps extends HTMLAttributes<HTMLTableSectionElement> {}

export function TableHead({ children, className = '', ...props }: TableHeadProps) {
  return (
    <thead className={`${styles.head} ${className}`} {...props}>
      {children}
    </thead>
  );
}

interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {}

export function TableBody({ children, className = '', ...props }: TableBodyProps) {
  return (
    <tbody className={`${styles.body} ${className}`} {...props}>
      {children}
    </tbody>
  );
}

interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  hoverable?: boolean;
}

export function TableRow({ children, hoverable = true, className = '', ...props }: TableRowProps) {
  return (
    <tr className={`${styles.row} ${hoverable ? styles.hoverable : ''} ${className}`} {...props}>
      {children}
    </tr>
  );
}

interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right';
  numeric?: boolean;
}

export function TableCell({
  children,
  align = 'left',
  numeric = false,
  className = '',
  ...props
}: TableCellProps) {
  return (
    <td
      className={`${styles.cell} ${styles[`align-${align}`]} ${numeric ? styles.numeric : ''} ${className}`}
      {...props}
    >
      {children}
    </td>
  );
}

interface TableHeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  sorted?: 'asc' | 'desc' | false;
  onSort?: () => void;
}

export function TableHeaderCell({
  children,
  align = 'left',
  sortable = false,
  sorted = false,
  onSort,
  className = '',
  ...props
}: TableHeaderCellProps) {
  return (
    <th
      className={`${styles.headerCell} ${styles[`align-${align}`]} ${sortable ? styles.sortable : ''} ${className}`}
      onClick={sortable ? onSort : undefined}
      {...props}
    >
      <span className={styles.headerContent}>
        {children}
        {sortable && (
          <span className={`${styles.sortIcon} ${sorted ? styles.sorted : ''}`}>
            {sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : '↕'}
          </span>
        )}
      </span>
    </th>
  );
}

// Empty state component
interface TableEmptyProps {
  message?: string;
  colSpan: number;
}

export function TableEmpty({ message = 'No data available', colSpan }: TableEmptyProps) {
  return (
    <tr>
      <td colSpan={colSpan} className={styles.empty}>
        <div className={styles.emptyContent}>
          <span className={styles.emptyIcon}>∅</span>
          <span>{message}</span>
        </div>
      </td>
    </tr>
  );
}
