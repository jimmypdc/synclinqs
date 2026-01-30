import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Calendar,
  User,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
} from 'lucide-react';
import styles from './ContributionModal.module.css';

interface Contribution {
  id: string;
  employeeId: string;
  payrollDate: string;
  employeePreTax: number;
  employeeRoth: number;
  employerMatch: number;
  employerNonMatch: number;
  loanRepayment: number;
  status: string;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    employeeNumber: string;
    firstName?: string;
    lastName?: string;
  };
}

interface ContributionModalProps {
  contribution: Contribution | null;
  onClose: () => void;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ContributionModal({ contribution, onClose }: ContributionModalProps) {
  if (!contribution) return null;

  const total =
    contribution.employeePreTax +
    contribution.employeeRoth +
    contribution.employerMatch +
    contribution.employerNonMatch;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <CheckCircle size={16} />;
      case 'FAILED':
      case 'CANCELLED':
        return <AlertCircle size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'active';
      case 'PENDING':
      case 'VALIDATED':
        return 'pending';
      case 'FAILED':
      case 'CANCELLED':
        return 'error';
      default:
        return 'inactive';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={styles.modal}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerContent}>
              <DollarSign size={24} className={styles.headerIcon} />
              <div>
                <h2 className={styles.title}>Contribution Details</h2>
                <p className={styles.subtitle}>
                  Payroll Date: {formatDate(contribution.payrollDate)}
                </p>
              </div>
            </div>
            <button onClick={onClose} className={styles.closeBtn}>
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className={styles.content}>
            {/* Status */}
            <div className={styles.statusSection}>
              <span className={`${styles.status} ${styles[getStatusClass(contribution.status)]}`}>
                {getStatusIcon(contribution.status)}
                {contribution.status}
              </span>
            </div>

            {/* Employee Info */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <User size={16} />
                Employee
              </h3>
              <div className={styles.infoRow}>
                <span className={styles.label}>Employee #</span>
                <code className={styles.mono}>
                  {contribution.employee?.employeeNumber || contribution.employeeId.slice(0, 8)}
                </code>
              </div>
              {contribution.employee?.firstName && (
                <div className={styles.infoRow}>
                  <span className={styles.label}>Name</span>
                  <span className={styles.value}>
                    {contribution.employee.firstName} {contribution.employee.lastName}
                  </span>
                </div>
              )}
            </div>

            {/* Amounts */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <DollarSign size={16} />
                Contribution Breakdown
              </h3>
              <div className={styles.amountsGrid}>
                <div className={styles.amountItem}>
                  <span className={styles.amountLabel}>Employee Pre-Tax</span>
                  <span className={styles.amountValue}>
                    {formatCurrency(contribution.employeePreTax)}
                  </span>
                </div>
                <div className={styles.amountItem}>
                  <span className={styles.amountLabel}>Employee Roth</span>
                  <span className={`${styles.amountValue} ${contribution.employeeRoth === 0 ? styles.muted : ''}`}>
                    {formatCurrency(contribution.employeeRoth)}
                  </span>
                </div>
                <div className={styles.amountItem}>
                  <span className={styles.amountLabel}>Employer Match</span>
                  <span className={styles.amountValue}>
                    {formatCurrency(contribution.employerMatch)}
                  </span>
                </div>
                <div className={styles.amountItem}>
                  <span className={styles.amountLabel}>Employer Non-Match</span>
                  <span className={`${styles.amountValue} ${contribution.employerNonMatch === 0 ? styles.muted : ''}`}>
                    {formatCurrency(contribution.employerNonMatch)}
                  </span>
                </div>
                {contribution.loanRepayment > 0 && (
                  <div className={styles.amountItem}>
                    <span className={styles.amountLabel}>Loan Repayment</span>
                    <span className={styles.amountValue}>
                      {formatCurrency(contribution.loanRepayment)}
                    </span>
                  </div>
                )}
              </div>
              <div className={styles.totalRow}>
                <span className={styles.totalLabel}>Total</span>
                <span className={styles.totalValue}>{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Timeline */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <FileText size={16} />
                Timeline
              </h3>
              <div className={styles.timeline}>
                <div className={styles.timelineItem}>
                  <Calendar size={14} />
                  <span className={styles.timelineLabel}>Payroll Date</span>
                  <span className={styles.timelineValue}>
                    {formatDate(contribution.payrollDate)}
                  </span>
                </div>
                <div className={styles.timelineItem}>
                  <Clock size={14} />
                  <span className={styles.timelineLabel}>Created</span>
                  <span className={styles.timelineValue}>
                    {formatDateTime(contribution.createdAt)}
                  </span>
                </div>
                {contribution.processedAt && (
                  <div className={styles.timelineItem}>
                    <CheckCircle size={14} />
                    <span className={styles.timelineLabel}>Processed</span>
                    <span className={styles.timelineValue}>
                      {formatDateTime(contribution.processedAt)}
                    </span>
                  </div>
                )}
                <div className={styles.timelineItem}>
                  <Clock size={14} />
                  <span className={styles.timelineLabel}>Last Updated</span>
                  <span className={styles.timelineValue}>
                    {formatDateTime(contribution.updatedAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* ID */}
            <div className={styles.idSection}>
              <span className={styles.idLabel}>Contribution ID</span>
              <code className={styles.idValue}>{contribution.id}</code>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
