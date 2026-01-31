import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  CheckSquare,
  Play,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Download,
} from 'lucide-react';
import { reconciliationApi } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import styles from './Reconciliation.module.css';

interface ReconciliationReport {
  id: string;
  reconciliationDate: string;
  sourceSystem: string;
  destinationSystem: string;
  totalRecords: number;
  matchedRecords: number;
  unmatchedSourceRecords: number;
  unmatchedDestinationRecords: number;
  amountDiscrepancies: number;
  totalSourceAmount: number;
  totalDestinationAmount: number;
  varianceAmount: number;
  status: 'pending' | 'reconciled' | 'discrepancies' | 'failed';
  createdAt: string;
}

interface ReconciliationItem {
  id: string;
  matchStatus: 'matched' | 'source_only' | 'destination_only' | 'amount_mismatch';
  sourceAmount: number;
  destinationAmount: number;
  varianceAmount: number;
  discrepancyReason: string;
}

interface DashboardData {
  todayStatus: string;
  totalReportsThisMonth: number;
  discrepancyRate: number;
  avgVariance: number;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function Reconciliation() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: dashboardData } = useQuery({
    queryKey: ['reconciliation-dashboard'],
    queryFn: () => reconciliationApi.getDashboard().then((r) => r.data),
    refetchInterval: 60000,
  });

  const { data: reportsData, isLoading } = useQuery({
    queryKey: ['reconciliation-reports', statusFilter],
    queryFn: () => reconciliationApi.listReports({
      status: statusFilter || undefined,
      limit: 20,
    }).then((r) => r.data),
  });

  const runMutation = useMutation({
    mutationFn: () => reconciliationApi.run(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation-reports'] });
      toast.success('Reconciliation started');
    },
    onError: () => toast.error('Failed to start reconciliation'),
  });

  const dashboard: DashboardData | null = dashboardData?.data ?? null;
  const reports: ReconciliationReport[] = reportsData?.data ?? [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'reconciled': return <CheckCircle size={16} className={styles.successIcon} />;
      case 'discrepancies': return <AlertTriangle size={16} className={styles.warningIcon} />;
      case 'failed': return <XCircle size={16} className={styles.errorIcon} />;
      default: return <Calendar size={16} className={styles.pendingIcon} />;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'reconciled': return styles.reconciled;
      case 'discrepancies': return styles.discrepancies;
      case 'failed': return styles.failed;
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
          <h1 className={styles.title}>Reconciliation</h1>
          <p className={styles.subtitle}>
            Daily reconciliation between payroll and recordkeeper data
          </p>
        </div>
        <button
          className={styles.runBtn}
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
        >
          <Play size={18} />
          {runMutation.isPending ? 'Running...' : 'Run Reconciliation'}
        </button>
      </div>

      {/* Dashboard Cards */}
      {dashboard && (
        <div className={styles.dashboardGrid}>
          <div className={styles.dashCard}>
            <div className={`${styles.dashIcon} ${styles.today}`}>
              <Calendar size={20} />
            </div>
            <div className={styles.dashContent}>
              <span className={styles.dashLabel}>Today's Status</span>
              <span className={styles.dashValue}>{dashboard.todayStatus || 'Not Run'}</span>
            </div>
          </div>
          <div className={styles.dashCard}>
            <div className={`${styles.dashIcon} ${styles.reports}`}>
              <CheckSquare size={20} />
            </div>
            <div className={styles.dashContent}>
              <span className={styles.dashLabel}>Reports This Month</span>
              <span className={styles.dashValue}>{dashboard.totalReportsThisMonth}</span>
            </div>
          </div>
          <div className={styles.dashCard}>
            <div className={`${styles.dashIcon} ${styles.rate}`}>
              <TrendingUp size={20} />
            </div>
            <div className={styles.dashContent}>
              <span className={styles.dashLabel}>Match Rate</span>
              <span className={styles.dashValue}>
                {(100 - (dashboard.discrepancyRate || 0)).toFixed(1)}%
              </span>
            </div>
          </div>
          <div className={styles.dashCard}>
            <div className={`${styles.dashIcon} ${styles.variance}`}>
              <AlertTriangle size={20} />
            </div>
            <div className={styles.dashContent}>
              <span className={styles.dashLabel}>Avg Variance</span>
              <span className={styles.dashValue}>
                {formatCurrency(dashboard.avgVariance || 0)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="">All Status</option>
          <option value="reconciled">Reconciled</option>
          <option value="discrepancies">Discrepancies</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Reports Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Systems</th>
              <th>Total Records</th>
              <th>Matched</th>
              <th>Discrepancies</th>
              <th>Variance</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={8}><div className={styles.skeleton} /></td>
                </tr>
              ))
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.emptyCell}>
                  <div className={styles.emptyState}>
                    <CheckSquare size={48} />
                    <h3>No reconciliation reports</h3>
                    <p>Run a reconciliation to generate reports</p>
                  </div>
                </td>
              </tr>
            ) : (
              reports.map((report) => {
                const isExpanded = expandedReport === report.id;
                const matchPercent = report.totalRecords > 0
                  ? ((report.matchedRecords / report.totalRecords) * 100).toFixed(1)
                  : '0';
                const discrepancyCount = report.unmatchedSourceRecords +
                  report.unmatchedDestinationRecords + report.amountDiscrepancies;

                return (
                  <>
                    <motion.tr
                      key={report.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={styles.reportRow}
                      onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                    >
                      <td>
                        <span className={styles.date}>
                          {new Date(report.reconciliationDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </td>
                      <td>
                        <span className={styles.systems}>
                          {report.sourceSystem} → {report.destinationSystem}
                        </span>
                      </td>
                      <td>{report.totalRecords}</td>
                      <td>
                        <span className={styles.matchCount}>
                          {report.matchedRecords}
                          <span className={styles.percent}>({matchPercent}%)</span>
                        </span>
                      </td>
                      <td>
                        <span className={discrepancyCount > 0 ? styles.discrepancyCount : ''}>
                          {discrepancyCount}
                        </span>
                      </td>
                      <td>
                        <span className={report.varianceAmount !== 0 ? styles.varianceAmount : ''}>
                          {formatCurrency(Math.abs(report.varianceAmount))}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${getStatusClass(report.status)}`}>
                          {getStatusIcon(report.status)}
                          {report.status}
                        </span>
                      </td>
                      <td>
                        <button className={styles.expandBtn}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                    </motion.tr>
                    {isExpanded && (
                      <tr className={styles.detailRow}>
                        <td colSpan={8}>
                          <ReportDetails reportId={report.id} report={report} />
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

function ReportDetails({ reportId, report }: { reportId: string; report: ReconciliationReport }) {
  const { data: itemsData } = useQuery({
    queryKey: ['reconciliation-items', reportId],
    queryFn: () => reconciliationApi.getItems(reportId, { limit: 10 }).then((r) => r.data),
  });

  const items: ReconciliationItem[] = itemsData?.data ?? [];

  return (
    <div className={styles.reportDetails}>
      <div className={styles.detailSummary}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Source Total</span>
          <span className={styles.summaryValue}>{formatCurrency(report.totalSourceAmount)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Destination Total</span>
          <span className={styles.summaryValue}>{formatCurrency(report.totalDestinationAmount)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Unmatched Source</span>
          <span className={styles.summaryValue}>{report.unmatchedSourceRecords}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Unmatched Dest</span>
          <span className={styles.summaryValue}>{report.unmatchedDestinationRecords}</span>
        </div>
      </div>

      {items.length > 0 && (
        <div className={styles.discrepancyItems}>
          <h4>Discrepancy Items</h4>
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Source Amount</th>
                <th>Dest Amount</th>
                <th>Variance</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {items.filter(i => i.matchStatus !== 'matched').slice(0, 5).map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className={`${styles.matchBadge} ${styles[item.matchStatus.replace('_', '')]}`}>
                      {item.matchStatus.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{formatCurrency(item.sourceAmount)}</td>
                  <td>{formatCurrency(item.destinationAmount)}</td>
                  <td className={item.varianceAmount !== 0 ? styles.varianceAmount : ''}>
                    {formatCurrency(Math.abs(item.varianceAmount))}
                  </td>
                  <td>{item.discrepancyReason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.detailActions}>
        <button className={styles.exportBtn}>
          <Download size={14} />
          Export Report
        </button>
      </div>
    </div>
  );
}
