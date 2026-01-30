import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  Plus,
  Server,
  Cloud,
  Globe,
  Webhook,
  CheckCircle,
  AlertTriangle,
  Clock,
  Play,
} from 'lucide-react';
import { Header } from '../components/layout';
import { Button, Card, CardHeader, Badge, getStatusVariant } from '../components/ui';
import { integrationsApi } from '../api';
import { formatRelativeTime } from '../utils/format';
import styles from './Integrations.module.css';

const typeIcons = {
  SFTP: Server,
  REST_API: Cloud,
  SOAP: Globe,
  WEBHOOK: Webhook,
};

export function IntegrationsPage() {
  const queryClient = useQueryClient();

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: integrationsApi.list,
  });

  const syncMutation = useMutation({
    mutationFn: (integrationId?: string) => integrationsApi.triggerSync(integrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
  });

  const handleSyncAll = () => {
    syncMutation.mutate(undefined);
  };

  const handleSyncOne = (integrationId: string) => {
    syncMutation.mutate(integrationId);
  };

  return (
    <>
      <Header
        title="Integrations"
        subtitle="Manage recordkeeper and payroll connections"
      />

      <div className={styles.content}>
        {/* Actions bar */}
        <motion.div
          className={styles.actionsBar}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className={styles.actionsInfo}>
            <span className={styles.integrationCount}>
              {integrations?.length || 0} integrations configured
            </span>
          </div>
          <div className={styles.actions}>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw size={14} className={syncMutation.isPending ? styles.spinning : ''} />}
              onClick={handleSyncAll}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? 'Syncing...' : 'Sync All'}
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Plus size={14} />}>
              Add Integration
            </Button>
          </div>
        </motion.div>

        {/* Integration Cards */}
        <div className={styles.integrationGrid}>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} padding="md">
                <div className={styles.skeletonCard}>
                  <div className="skeleton" style={{ width: 48, height: 48 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ width: '60%', height: 20, marginBottom: 8 }} />
                    <div className="skeleton" style={{ width: '40%', height: 14 }} />
                  </div>
                </div>
              </Card>
            ))
          ) : integrations?.length === 0 ? (
            <Card padding="lg" className={styles.emptyCard}>
              <div className={styles.emptyState}>
                <Server size={48} className={styles.emptyIcon} />
                <h3>No integrations configured</h3>
                <p>Connect your first recordkeeper or payroll system to get started.</p>
                <Button variant="primary" leftIcon={<Plus size={16} />}>
                  Add Integration
                </Button>
              </div>
            </Card>
          ) : (
            integrations?.map((integration, index) => {
              const Icon = typeIcons[integration.type] || Server;
              const isActive = integration.status === 'ACTIVE';
              const hasError = integration.status === 'ERROR';

              return (
                <motion.div
                  key={integration.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card padding="none" className={`${styles.integrationCard} ${hasError ? styles.hasError : ''}`}>
                    <div className={styles.cardContent}>
                      <div className={styles.integrationHeader}>
                        <div className={`${styles.iconWrapper} ${isActive ? styles.active : hasError ? styles.error : ''}`}>
                          <Icon size={24} />
                        </div>
                        <div className={styles.integrationInfo}>
                          <h3 className={styles.integrationName}>{integration.name}</h3>
                          <span className={styles.integrationType}>{integration.type.replace('_', ' ')}</span>
                        </div>
                        <Badge variant={getStatusVariant(integration.status)} dot>
                          {integration.status}
                        </Badge>
                      </div>

                      <div className={styles.statusDetails}>
                        <div className={styles.statusItem}>
                          <span className={styles.statusLabel}>Last Sync</span>
                          <span className={styles.statusValue}>
                            {integration.lastSyncAt
                              ? formatRelativeTime(integration.lastSyncAt)
                              : 'Never'}
                          </span>
                        </div>
                        <div className={styles.statusItem}>
                          <span className={styles.statusLabel}>Last Status</span>
                          <span className={`${styles.statusValue} ${integration.lastSyncStatus === 'SUCCESS' ? styles.success : integration.lastSyncStatus === 'FAILED' ? styles.failed : ''}`}>
                            {integration.lastSyncStatus || '—'}
                          </span>
                        </div>
                      </div>

                      <div className={styles.statusIndicator}>
                        {isActive ? (
                          <CheckCircle size={14} className={styles.indicatorSuccess} />
                        ) : hasError ? (
                          <AlertTriangle size={14} className={styles.indicatorError} />
                        ) : (
                          <Clock size={14} className={styles.indicatorWarning} />
                        )}
                        <span>
                          {isActive
                            ? 'Connection healthy'
                            : hasError
                              ? 'Connection error'
                              : 'Connection inactive'}
                        </span>
                      </div>
                    </div>

                    <div className={styles.cardFooter}>
                      <Button variant="ghost" size="sm">
                        Configure
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<Play size={12} />}
                        onClick={() => handleSyncOne(integration.id)}
                        disabled={syncMutation.isPending}
                      >
                        Sync Now
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Sync History Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card padding="md">
            <CardHeader
              title="Sync Queue"
              subtitle="Background job status"
            />
            <div className={styles.queueInfo}>
              <div className={styles.queueStat}>
                <span className={styles.queueLabel}>Pending Jobs</span>
                <span className={styles.queueValue}>0</span>
              </div>
              <div className={styles.queueStat}>
                <span className={styles.queueLabel}>Failed (24h)</span>
                <span className={`${styles.queueValue} ${styles.queueError}`}>0</span>
              </div>
              <div className={styles.queueStat}>
                <span className={styles.queueLabel}>Completed (24h)</span>
                <span className={`${styles.queueValue} ${styles.queueSuccess}`}>12</span>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </>
  );
}
