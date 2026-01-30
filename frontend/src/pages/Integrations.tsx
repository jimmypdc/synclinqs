import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Zap,
  RefreshCw,
  Settings,
  Server,
  Globe,
  FileText,
  Webhook,
  Plus,
} from 'lucide-react';
import { integrationsApi } from '../lib/api';
import { IntegrationModal } from '../components/IntegrationModal';
import styles from './Integrations.module.css';

interface Integration {
  id: string;
  name: string;
  type: 'SFTP' | 'REST_API' | 'SOAP' | 'WEBHOOK';
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
}

const typeIcons = {
  SFTP: Server,
  REST_API: Globe,
  SOAP: FileText,
  WEBHOOK: Webhook,
};

function formatTime(dateString: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function Integrations() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => integrationsApi.list().then((r) => r.data),
  });

  const syncMutation = useMutation({
    mutationFn: () => integrationsApi.triggerSync(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
  });

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'active';
      case 'ERROR':
        return 'error';
      default:
        return 'inactive';
    }
  };

  const getSyncStatusClass = (status: string | null) => {
    switch (status) {
      case 'SUCCESS':
        return 'active';
      case 'PROCESSING':
        return 'pending';
      case 'FAILED':
        return 'error';
      default:
        return 'inactive';
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
          <h1 className={styles.title}>Integrations</h1>
          <p className={styles.subtitle}>
            Manage connections with recordkeepers and payroll systems
          </p>
        </div>
        <button
          className={styles.syncBtn}
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          <RefreshCw
            size={18}
            className={syncMutation.isPending ? styles.spinning : ''}
          />
          {syncMutation.isPending ? 'Syncing...' : 'Sync All'}
        </button>
      </div>

      {/* Integration cards */}
      <div className={styles.grid}>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles.cardSkeleton}>
              <div className={styles.skeletonIcon} />
              <div className={styles.skeletonContent}>
                <div className={styles.skeletonLine} />
                <div className={styles.skeletonLineShort} />
              </div>
            </div>
          ))
        ) : integrations?.data?.length === 0 ? (
          <div className={styles.emptyState}>
            <Zap size={48} />
            <h3>No integrations configured</h3>
            <p>Set up connections to sync data with external systems</p>
          </div>
        ) : (
          integrations?.data?.map((integration: Integration, index: number) => {
            const Icon = typeIcons[integration.type] || Server;
            return (
              <motion.div
                key={integration.id}
                className={styles.card}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className={styles.cardHeader}>
                  <div className={`${styles.iconWrapper} ${styles[getStatusClass(integration.status)]}`}>
                    <Icon size={24} />
                  </div>
                  <div className={styles.cardInfo}>
                    <h3 className={styles.cardName}>{integration.name}</h3>
                    <span className={styles.cardType}>{integration.type.replace('_', ' ')}</span>
                  </div>
                  <button
                    className={styles.settingsBtn}
                    onClick={() => setSelectedIntegration(integration)}
                  >
                    <Settings size={16} />
                  </button>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.statusRow}>
                    <span className={styles.statusLabel}>Status</span>
                    <span className={`${styles.statusBadge} ${styles[getStatusClass(integration.status)]}`}>
                      <span className={`status-dot ${getStatusClass(integration.status)}`} />
                      {integration.status}
                    </span>
                  </div>

                  <div className={styles.statusRow}>
                    <span className={styles.statusLabel}>Last Sync</span>
                    <span className={styles.statusValue}>
                      {formatTime(integration.lastSyncAt)}
                    </span>
                  </div>

                  <div className={styles.statusRow}>
                    <span className={styles.statusLabel}>Sync Status</span>
                    <span className={`${styles.syncStatus} ${styles[getSyncStatusClass(integration.lastSyncStatus)]}`}>
                      {integration.lastSyncStatus || 'PENDING'}
                    </span>
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <button
                    className={styles.actionBtn}
                    onClick={() => integrationsApi.triggerSync(integration.id).then(() => {
                      queryClient.invalidateQueries({ queryKey: ['integrations'] });
                    })}
                  >
                    <RefreshCw size={14} />
                    Sync Now
                  </button>
                  <button className={styles.actionBtnSecondary}>
                    View Logs
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Add integration card */}
      <motion.div
        className={styles.addCard}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <Zap size={32} className={styles.addIcon} />
        <div className={styles.addContent}>
          <h3>Add New Integration</h3>
          <p>Connect to SFTP, REST API, SOAP, or Webhook endpoints</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowModal(true)}>
          <Plus size={18} />
          Configure
        </button>
      </motion.div>

      {/* Integration Modal */}
      {(showModal || selectedIntegration) && (
        <IntegrationModal
          integration={selectedIntegration}
          onClose={() => {
            setShowModal(false);
            setSelectedIntegration(null);
          }}
        />
      )}
    </motion.div>
  );
}
