import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  RefreshCw,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import { errorsApi } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import styles from './ErrorQueue.module.css';

interface ErrorItem {
  id: string;
  errorType: string;
  severity: 'critical' | 'error' | 'warning';
  sourceSystem: string;
  destinationSystem: string;
  errorMessage: string;
  errorData: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'retrying' | 'resolved' | 'failed_permanently' | 'manual_review';
  createdAt: string;
  nextRetryAt: string | null;
}

interface ErrorStats {
  total: number;
  pending: number;
  retrying: number;
  resolved: number;
  failedPermanently: number;
  bySeverity: { critical: number; error: number; warning: number };
}

const severityIcons = {
  critical: XCircle,
  error: AlertCircle,
  warning: AlertTriangle,
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  retrying: 'Retrying',
  resolved: 'Resolved',
  failed_permanently: 'Failed',
  manual_review: 'Manual Review',
};

export function ErrorQueue() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const [selectedErrors, setSelectedErrors] = useState<Set<string>>(new Set());

  const { data: errorsData, isLoading } = useQuery({
    queryKey: ['errors', statusFilter, severityFilter],
    queryFn: () => errorsApi.list({
      status: statusFilter || undefined,
      severity: severityFilter || undefined,
      limit: 50,
    }).then((r) => r.data),
  });

  const { data: statsData } = useQuery({
    queryKey: ['error-stats'],
    queryFn: () => errorsApi.getStats().then((r) => r.data),
    refetchInterval: 30000,
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => errorsApi.retry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['errors'] });
      queryClient.invalidateQueries({ queryKey: ['error-stats'] });
      toast.success('Retry initiated');
    },
    onError: () => toast.error('Failed to retry'),
  });

  const bulkRetryMutation = useMutation({
    mutationFn: (ids: string[]) => errorsApi.bulkRetry(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['errors'] });
      queryClient.invalidateQueries({ queryKey: ['error-stats'] });
      setSelectedErrors(new Set());
      toast.success('Bulk retry initiated');
    },
    onError: () => toast.error('Failed to bulk retry'),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      errorsApi.resolve(id, { resolutionNotes: notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['errors'] });
      queryClient.invalidateQueries({ queryKey: ['error-stats'] });
      toast.success('Error resolved');
    },
    onError: () => toast.error('Failed to resolve'),
  });

  const errors: ErrorItem[] = errorsData?.data ?? [];
  const stats: ErrorStats | null = statsData?.data ?? null;

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedErrors);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedErrors(newSelected);
  };

  const selectAll = () => {
    if (selectedErrors.size === errors.length) {
      setSelectedErrors(new Set());
    } else {
      setSelectedErrors(new Set(errors.map(e => e.id)));
    }
  };

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'critical': return styles.critical;
      case 'error': return styles.error;
      case 'warning': return styles.warning;
      default: return '';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'resolved': return styles.resolved;
      case 'failed_permanently': return styles.failed;
      case 'retrying': return styles.retrying;
      default: return styles.pending;
    }
  };

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Error Queue</h1>
          <p className={styles.subtitle}>
            Monitor and manage failed processing records
          </p>
        </div>
        {selectedErrors.size > 0 && (
          <button
            className={styles.bulkBtn}
            onClick={() => bulkRetryMutation.mutate(Array.from(selectedErrors))}
            disabled={bulkRetryMutation.isPending}
          >
            <RotateCcw size={16} />
            Retry Selected ({selectedErrors.size})
          </button>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.total}`}>
              <AlertCircle size={20} />
            </div>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{stats.total}</span>
              <span className={styles.statLabel}>Total Errors</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.pending}`}>
              <Clock size={20} />
            </div>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{stats.pending}</span>
              <span className={styles.statLabel}>Pending</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.critical}`}>
              <XCircle size={20} />
            </div>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{stats.bySeverity?.critical ?? 0}</span>
              <span className={styles.statLabel}>Critical</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.resolved}`}>
              <CheckCircle size={20} />
            </div>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{stats.resolved}</span>
              <span className={styles.statLabel}>Resolved</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterWrapper}>
          <Filter size={16} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="retrying">Retrying</option>
            <option value="manual_review">Manual Review</option>
            <option value="resolved">Resolved</option>
            <option value="failed_permanently">Failed Permanently</option>
          </select>
        </div>
        <div className={styles.filterWrapper}>
          <AlertCircle size={16} />
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All Severity</option>
            <option value="critical">Critical</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
          </select>
        </div>
      </div>

      {/* Errors Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={selectedErrors.size === errors.length && errors.length > 0}
                  onChange={selectAll}
                />
              </th>
              <th>Severity</th>
              <th>Error Type</th>
              <th>Message</th>
              <th>Retries</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={8}>
                    <div className={styles.skeleton} />
                  </td>
                </tr>
              ))
            ) : errors.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.emptyCell}>
                  <div className={styles.emptyState}>
                    <CheckCircle size={48} />
                    <h3>No errors found</h3>
                    <p>All clear! No errors matching your filters.</p>
                  </div>
                </td>
              </tr>
            ) : (
              errors.map((error) => {
                const SeverityIcon = severityIcons[error.severity] || AlertCircle;
                const isExpanded = expandedError === error.id;
                return (
                  <>
                    <motion.tr
                      key={error.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={styles.errorRow}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedErrors.has(error.id)}
                          onChange={() => toggleSelect(error.id)}
                        />
                      </td>
                      <td>
                        <span className={`${styles.severityBadge} ${getSeverityClass(error.severity)}`}>
                          <SeverityIcon size={14} />
                          {error.severity}
                        </span>
                      </td>
                      <td>
                        <span className={styles.errorType}>{error.errorType}</span>
                      </td>
                      <td>
                        <span className={styles.errorMessage}>{error.errorMessage}</span>
                      </td>
                      <td>
                        <span className={styles.retryCount}>
                          {error.retryCount}/{error.maxRetries}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${getStatusClass(error.status)}`}>
                          {statusLabels[error.status]}
                        </span>
                      </td>
                      <td>
                        <span className={styles.date}>
                          {new Date(error.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          {error.status !== 'resolved' && error.status !== 'failed_permanently' && (
                            <button
                              className={styles.actionBtn}
                              onClick={() => retryMutation.mutate(error.id)}
                              disabled={retryMutation.isPending}
                              title="Retry"
                            >
                              <RefreshCw size={14} />
                            </button>
                          )}
                          <button
                            className={styles.actionBtn}
                            onClick={() => setExpandedError(isExpanded ? null : error.id)}
                            title="Details"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                    {isExpanded && (
                      <tr className={styles.detailRow}>
                        <td colSpan={8}>
                          <div className={styles.errorDetails}>
                            <div className={styles.detailSection}>
                              <h4>Error Data</h4>
                              <pre>{JSON.stringify(error.errorData, null, 2)}</pre>
                            </div>
                            <div className={styles.detailSection}>
                              <h4>Systems</h4>
                              <p>{error.sourceSystem} → {error.destinationSystem}</p>
                            </div>
                            {error.nextRetryAt && (
                              <div className={styles.detailSection}>
                                <h4>Next Retry</h4>
                                <p>{new Date(error.nextRetryAt).toLocaleString()}</p>
                              </div>
                            )}
                            {error.status !== 'resolved' && (
                              <button
                                className={styles.resolveBtn}
                                onClick={() => resolveMutation.mutate({
                                  id: error.id,
                                  notes: 'Manually resolved'
                                })}
                              >
                                <CheckCircle size={14} />
                                Mark as Resolved
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
