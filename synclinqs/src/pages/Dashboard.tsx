import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users,
  DollarSign,
  RefreshCw,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { Header } from '../components/layout';
import { StatCard, Card, CardHeader, Badge, getStatusVariant, Button } from '../components/ui';
import { dashboardApi, integrationsApi } from '../api';
import { formatCurrency, formatNumber, formatRelativeTime } from '../utils/format';
import styles from './Dashboard.module.css';

export function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardApi.getStats,
  });

  const { data: summary } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => dashboardApi.getContributionSummary(),
  });

  const { data: trends } = useQuery({
    queryKey: ['dashboard', 'trends'],
    queryFn: () => dashboardApi.getContributionTrends({ months: 6 }),
  });

  const { data: syncStatus } = useQuery({
    queryKey: ['dashboard', 'sync-status'],
    queryFn: dashboardApi.getSyncStatus,
  });

  const { data: auditLogs } = useQuery({
    queryKey: ['dashboard', 'audit-logs'],
    queryFn: () => dashboardApi.getAuditLogs({ limit: 5 }),
  });

  const handleTriggerSync = async () => {
    try {
      await integrationsApi.triggerSync();
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  // Format chart data
  const chartData = trends?.map((t) => ({
    name: t.month,
    amount: t.totalAmount / 100,
    count: t.contributionCount,
  })) || [];

  // Summary breakdown for bar chart
  const summaryData = summary
    ? [
        { name: 'Pre-Tax', value: summary.totalEmployeePreTax / 100, fill: 'var(--accent-primary)' },
        { name: 'Roth', value: summary.totalEmployeeRoth / 100, fill: 'var(--info)' },
        { name: 'Match', value: summary.totalEmployerMatch / 100, fill: 'var(--success)' },
      ]
    : [];

  return (
    <>
      <Header
        title="Dashboard"
        subtitle="Overview of your 401(k) integration activity"
      />

      <div className={styles.content}>
        {/* Stats Grid */}
        <section className={styles.statsGrid}>
          <StatCard
            label="Total Employees"
            value={statsLoading ? '—' : formatNumber(stats?.totalEmployees || 0)}
            icon={Users}
            subtext={`${stats?.activeEmployees || 0} active`}
            variant="default"
            delay={0}
          />
          <StatCard
            label="YTD Contributions"
            value={statsLoading ? '—' : formatCurrency(stats?.ytdContributions || 0)}
            icon={DollarSign}
            trend={{ value: 12.5, isPositive: true }}
            variant="accent"
            delay={0.1}
          />
          <StatCard
            label="Pending"
            value={statsLoading ? '—' : formatNumber(stats?.pendingContributions || 0)}
            icon={Clock}
            subtext="contributions"
            variant="warning"
            delay={0.2}
          />
          <StatCard
            label="Last Sync"
            value={
              statsLoading
                ? '—'
                : stats?.lastSyncAt
                  ? formatRelativeTime(stats.lastSyncAt)
                  : 'Never'
            }
            icon={RefreshCw}
            variant="success"
            delay={0.3}
          />
        </section>

        {/* Charts Row */}
        <section className={styles.chartsRow}>
          {/* Contribution Trends */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card padding="md">
              <CardHeader
                title="Contribution Trends"
                subtitle="Last 6 months"
                action={
                  <Button variant="ghost" size="sm" rightIcon={<ArrowRight size={14} />}>
                    View All
                  </Button>
                }
              />
              <div className={styles.chartContainer}>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis
                      dataKey="name"
                      stroke="var(--text-muted)"
                      fontSize={11}
                      fontFamily="var(--font-mono)"
                      tickLine={false}
                    />
                    <YAxis
                      stroke="var(--text-muted)"
                      fontSize={11}
                      fontFamily="var(--font-mono)"
                      tickLine={false}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 0,
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                      }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Total']}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="var(--accent-primary)"
                      strokeWidth={2}
                      fill="url(#colorAmount)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </motion.div>

          {/* Contribution Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card padding="md">
              <CardHeader
                title="Contribution Breakdown"
                subtitle="Current period"
              />
              <div className={styles.chartContainer}>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={summaryData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="var(--text-muted)"
                      fontSize={11}
                      fontFamily="var(--font-mono)"
                      tickLine={false}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="var(--text-muted)"
                      fontSize={11}
                      fontFamily="var(--font-mono)"
                      tickLine={false}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 0,
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                      }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']}
                    />
                    <Bar dataKey="value" radius={0} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </motion.div>
        </section>

        {/* Bottom Row */}
        <section className={styles.bottomRow}>
          {/* Integration Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card padding="md">
              <CardHeader
                title="Integration Status"
                subtitle={`${syncStatus?.integrations?.length || 0} configured`}
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<RefreshCw size={14} />}
                    onClick={handleTriggerSync}
                  >
                    Sync All
                  </Button>
                }
              />
              <div className={styles.integrationList}>
                {syncStatus?.integrations?.map((integration) => (
                  <div key={integration.id} className={styles.integrationItem}>
                    <div className={styles.integrationInfo}>
                      <span className={styles.integrationName}>{integration.name}</span>
                      <span className={styles.integrationType}>{integration.type}</span>
                    </div>
                    <div className={styles.integrationStatus}>
                      {integration.status === 'ACTIVE' ? (
                        <CheckCircle size={16} className={styles.statusSuccess} />
                      ) : integration.status === 'ERROR' ? (
                        <AlertTriangle size={16} className={styles.statusError} />
                      ) : (
                        <Clock size={16} className={styles.statusWarning} />
                      )}
                      <Badge variant={getStatusVariant(integration.status)} size="sm">
                        {integration.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                {(!syncStatus?.integrations || syncStatus.integrations.length === 0) && (
                  <div className={styles.emptyState}>
                    <span>No integrations configured</span>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card padding="md">
              <CardHeader
                title="Recent Activity"
                subtitle="Audit trail"
                action={
                  <Button variant="ghost" size="sm" rightIcon={<ArrowRight size={14} />}>
                    View All
                  </Button>
                }
              />
              <div className={styles.activityList}>
                {auditLogs?.logs?.map((log) => (
                  <div key={log.id} className={styles.activityItem}>
                    <div className={styles.activityIcon}>
                      <TrendingUp size={14} />
                    </div>
                    <div className={styles.activityContent}>
                      <span className={styles.activityAction}>{log.action}</span>
                      <span className={styles.activityMeta}>
                        {log.entityType} • {formatRelativeTime(log.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
                {(!auditLogs?.logs || auditLogs.logs.length === 0) && (
                  <div className={styles.emptyState}>
                    <span>No recent activity</span>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        </section>
      </div>
    </>
  );
}
