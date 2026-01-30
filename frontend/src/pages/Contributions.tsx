import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search,
  Upload,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download,
} from 'lucide-react';
import { contributionsApi } from '../lib/api';
import { ContributionModal } from '../components/ContributionModal';
import { FileUploadModal } from '../components/FileUploadModal';
import { exportContributions } from '../utils/export';
import { useToast } from '../contexts/ToastContext';
import styles from './Contributions.module.css';

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
  employee?: {
    employeeNumber: string;
  };
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function Contributions() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const limit = 15;

  const handleExport = () => {
    if (contributions.length === 0) {
      toast.warning('No contributions to export');
      return;
    }
    exportContributions(contributions);
    toast.success(`Exported ${contributions.length} contributions to CSV`);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['contributions', page, status],
    queryFn: () =>
      contributionsApi.list({ page, limit, status: status || undefined }).then((r) => r.data),
  });

  const contributions = data?.data ?? [];
  const pagination = data?.pagination;

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

  const getTotalAmount = (c: Contribution) =>
    c.employeePreTax + c.employeeRoth + c.employerMatch + c.employerNonMatch;

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Contributions</h1>
          <p className={styles.subtitle}>
            Track and manage 401(k) contribution records
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.exportBtn} onClick={handleExport}>
            <Download size={18} />
            Export CSV
          </button>
          <button className={styles.uploadBtn} onClick={() => setShowUploadModal(true)}>
            <Upload size={18} />
            Upload CSV
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by employee..."
            className={styles.searchInput}
          />
        </div>
        <div className={styles.filters}>
          <Filter size={16} className={styles.filterIcon} />
          <select
            className={styles.select}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="VALIDATED">Validated</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee</th>
              <th className={styles.alignRight}>Pre-Tax</th>
              <th className={styles.alignRight}>Roth</th>
              <th className={styles.alignRight}>Employer</th>
              <th className={styles.alignRight}>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={7}>
                    <div className={styles.skeleton} />
                  </td>
                </tr>
              ))
            ) : contributions.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  <div className={styles.emptyState}>
                    <DollarSign size={32} />
                    <span>No contributions found</span>
                  </div>
                </td>
              </tr>
            ) : (
              contributions.map((contribution: Contribution, index: number) => (
                <motion.tr
                  key={contribution.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => setSelectedContribution(contribution)}
                  className={styles.clickableRow}
                >
                  <td>
                    <span className={styles.date}>
                      {new Date(contribution.payrollDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </td>
                  <td>
                    <code className={styles.mono}>
                      {contribution.employee?.employeeNumber || contribution.employeeId.slice(0, 8)}
                    </code>
                  </td>
                  <td className={styles.alignRight}>
                    <span className={styles.amount}>
                      {formatCurrency(contribution.employeePreTax)}
                    </span>
                  </td>
                  <td className={styles.alignRight}>
                    <span className={`${styles.amount} ${contribution.employeeRoth === 0 ? styles.muted : ''}`}>
                      {formatCurrency(contribution.employeeRoth)}
                    </span>
                  </td>
                  <td className={styles.alignRight}>
                    <span className={styles.amount}>
                      {formatCurrency(contribution.employerMatch + contribution.employerNonMatch)}
                    </span>
                  </td>
                  <td className={styles.alignRight}>
                    <span className={styles.total}>
                      {formatCurrency(getTotalAmount(contribution))}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`${styles.status} ${styles[getStatusClass(contribution.status)]}`}
                    >
                      <span className={`status-dot ${getStatusClass(contribution.status)}`} />
                      {contribution.status}
                    </span>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary bar */}
      {contributions.length > 0 && (
        <div className={styles.summaryBar}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Page Total</span>
            <span className={styles.summaryValue}>
              {formatCurrency(
                contributions.reduce((sum: number, c: Contribution) => sum + getTotalAmount(c), 0)
              )}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Records</span>
            <span className={styles.summaryValue}>{contributions.length}</span>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            Showing {(page - 1) * limit + 1}-
            {Math.min(page * limit, pagination.total)} of {pagination.total}
          </span>
          <div className={styles.paginationControls}>
            <button
              className={styles.paginationBtn}
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span className={styles.pageIndicator}>
              {page} / {pagination.totalPages}
            </span>
            <button
              className={styles.paginationBtn}
              disabled={page === pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Contribution Detail Modal */}
      {selectedContribution && (
        <ContributionModal
          contribution={selectedContribution}
          onClose={() => setSelectedContribution(null)}
        />
      )}

      {/* File Upload Modal */}
      {showUploadModal && (
        <FileUploadModal onClose={() => setShowUploadModal(false)} />
      )}
    </motion.div>
  );
}
