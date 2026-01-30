import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  X,
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  PlayCircle,
  Loader2,
} from 'lucide-react';
import { integrationsApi } from '../lib/api';
import styles from './IntegrationLogsModal.module.css';

interface Integration {
  id: string;
  name: string;
  type: string;
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  newValues?: {
    jobId?: string;
    recordsProcessed?: number;
    completedAt?: string;
    integrationType?: string;
    errorMessage?: string;
  };
}

interface IntegrationLogsModalProps {
  integration: Integration;
  onClose: () => void;
}

function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getActionIcon(action: string) {
  switch (action) {
    case 'SYNC_COMPLETED':
      return CheckCircle;
    case 'SYNC_FAILED':
      return AlertCircle;
    case 'SYNC_STARTED':
      return PlayCircle;
    case 'SYNC_QUEUED':
      return Clock;
    default:
      return Activity;
  }
}

function getActionColor(action: string) {
  switch (action) {
    case 'SYNC_COMPLETED':
      return 'success';
    case 'SYNC_FAILED':
      return 'error';
    case 'SYNC_STARTED':
    case 'SYNC_QUEUED':
      return 'info';
    default:
      return 'default';
  }
}

function formatAction(action: string): string {
  return action.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

export function IntegrationLogsModal({ integration, onClose }: IntegrationLogsModalProps) {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['integration-logs', integration.id],
    queryFn: () => integrationsApi.getLogs(integration.id, { limit: 50 }).then((r) => r.data),
  });

  const logs: AuditLog[] = data?.data || [];

  return (
    <>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
      >
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <Activity size={20} className={styles.headerIcon} />
            <div>
              <h2 className={styles.title}>Sync Logs</h2>
              <p className={styles.subtitle}>{integration.name}</p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.refreshBtn}
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw size={16} className={isRefetching ? styles.spinning : ''} />
            </button>
            <button className={styles.closeBtn} onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className={styles.content}>
          {isLoading ? (
            <div className={styles.loadingState}>
              <Loader2 size={32} className={styles.spinning} />
              <span>Loading logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className={styles.emptyState}>
              <Activity size={48} />
              <h3>No sync logs yet</h3>
              <p>Logs will appear here after the first sync</p>
            </div>
          ) : (
            <div className={styles.timeline}>
              {logs.map((log, index) => {
                const Icon = getActionIcon(log.action);
                const colorClass = getActionColor(log.action);

                return (
                  <div key={log.id} className={styles.logItem}>
                    <div className={styles.timelineConnector}>
                      <div className={`${styles.timelineDot} ${styles[colorClass]}`}>
                        <Icon size={14} />
                      </div>
                      {index < logs.length - 1 && <div className={styles.timelineLine} />}
                    </div>
                    <div className={styles.logContent}>
                      <div className={styles.logHeader}>
                        <span className={`${styles.logAction} ${styles[colorClass]}`}>
                          {formatAction(log.action)}
                        </span>
                        <span className={styles.logTime}>
                          {formatTimestamp(log.createdAt)}
                        </span>
                      </div>
                      {log.newValues && (
                        <div className={styles.logDetails}>
                          {log.newValues.jobId && (
                            <div className={styles.logDetail}>
                              <span className={styles.logLabel}>Job ID:</span>
                              <code className={styles.logValue}>{log.newValues.jobId}</code>
                            </div>
                          )}
                          {log.newValues.recordsProcessed !== undefined && (
                            <div className={styles.logDetail}>
                              <span className={styles.logLabel}>Records:</span>
                              <span className={styles.logValue}>
                                {log.newValues.recordsProcessed.toLocaleString()}
                              </span>
                            </div>
                          )}
                          {log.newValues.errorMessage && (
                            <div className={`${styles.logDetail} ${styles.error}`}>
                              <span className={styles.logLabel}>Error:</span>
                              <span className={styles.logValue}>{log.newValues.errorMessage}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
