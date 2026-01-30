import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users,
  DollarSign,
  Activity,
  Clock,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { dashboardApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import styles from './Dashboard.module.css';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function Dashboard() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.getStats().then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: trends } = useQuery({
    queryKey: ['contribution-trends'],
    queryFn: () => dashboardApi.getContributionTrends(6).then((r) => r.data),
  });

  const { data: auditLogs } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => dashboardApi.getAuditLogs(10).then((r) => r.data),
  });

  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status'],
    queryFn: () => dashboardApi.getSyncStatus().then((r) => r.data),
  });

  const statCards = [
    {
      label: 'Active Employees',
      value: stats?.employees?.active ?? 0,
      change: '+12%',
      positive: true,
      icon: Users,
      color: 'primary',
    },
    {
      label: 'This Month',
      value: formatCurrency(stats?.contributions?.thisMonth?.total ?? 0),
      change: '+8.2%',
      positive: true,
      icon: DollarSign,
      color: 'success',
    },
    {
      label: 'Pending',
      value: stats?.contributions?.pending ?? 0,
      change: '-3',
      positive: false,
      icon: Clock,
      color: 'warning',
    },
    {
      label: 'Integrations',
      value: stats?.integrations?.active ?? 0,
      change: 'Active',
      positive: true,
      icon: Activity,
      color: 'primary',
    },
  ];

  return (
    <motion.div
      className={styles.dashboard}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.header className={styles.header} variants={itemVariants}>
        <div>
          <h1 className={styles.greeting}>
            Welcome back, {user?.firstName}
          </h1>
          <p className={styles.subtitle}>
            Here's what's happening with {user?.organization?.name}
          </p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.liveIndicator}>
            <span className="status-dot active" />
            <span>Live</span>
          </div>
        </div>
      </motion.header>

      {/* Stats Grid */}
      <motion.div className={styles.statsGrid} variants={itemVariants}>
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.label}
            className={`${styles.statCard} ${styles[stat.color]}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className={styles.statIcon}>
              <stat.icon size={20} />
            </div>
            <div className={styles.statContent}>
              <span className={styles.statLabel}>{stat.label}</span>
              <span className={styles.statValue}>{stat.value}</span>
            </div>
            <div className={`${styles.statChange} ${stat.positive ? styles.positive : styles.negative}`}>
              {stat.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              <span>{stat.change}</span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Main content grid */}
      <div className={styles.contentGrid}>
        {/* Chart */}
        <motion.div className={styles.chartCard} variants={itemVariants}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Contribution Trends</h2>
            <div className={styles.chartLegend}>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: 'var(--accent-primary)' }} />
                Employee
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: 'var(--accent-success)' }} />
                Employer
              </span>
            </div>
          </div>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trends ?? []}>
                <defs>
                  <linearGradient id="employeeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D9FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00D9FF" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="employerGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#71717A', fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#71717A', fontSize: 12 }}
                  tickFormatter={(value) => `$${(value / 100000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: '#18181B',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '12px',
                  }}
                  formatter={(value: number) => [formatCurrency(value), '']}
                />
                <Area
                  type="monotone"
                  dataKey="employeeContributions"
                  stroke="#00D9FF"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#employeeGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="employerContributions"
                  stroke="#10B981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#employerGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Sync Status */}
        <motion.div className={styles.syncCard} variants={itemVariants}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Integration Status</h2>
            <Zap size={16} className={styles.cardIcon} />
          </div>
          <div className={styles.syncList}>
            {syncStatus?.lastSyncTimes?.map((integration: {
              integrationId: string;
              name: string;
              type: string;
              lastSyncAt: string | null;
              lastSyncStatus: string | null;
            }) => (
              <div key={integration.integrationId} className={styles.syncItem}>
                <div className={styles.syncInfo}>
                  <span className={styles.syncName}>{integration.name}</span>
                  <span className={styles.syncType}>{integration.type}</span>
                </div>
                <div className={styles.syncStatus}>
                  <span
                    className={`status-dot ${
                      integration.lastSyncStatus === 'SUCCESS'
                        ? 'active'
                        : integration.lastSyncStatus === 'PROCESSING'
                        ? 'pending'
                        : integration.lastSyncStatus === 'FAILED'
                        ? 'error'
                        : 'inactive'
                    }`}
                  />
                  <span className={styles.syncTime}>
                    {integration.lastSyncAt
                      ? formatTime(integration.lastSyncAt)
                      : 'Never'}
                  </span>
                </div>
              </div>
            ))}
            {(!syncStatus?.lastSyncTimes || syncStatus.lastSyncTimes.length === 0) && (
              <div className={styles.emptyState}>No integrations configured</div>
            )}
          </div>
        </motion.div>

        {/* Activity Feed */}
        <motion.div className={styles.activityCard} variants={itemVariants}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Recent Activity</h2>
            <TrendingUp size={16} className={styles.cardIcon} />
          </div>
          <div className={styles.activityList}>
            {auditLogs?.map((log: {
              id: string;
              userName: string | null;
              action: string;
              entityType: string;
              createdAt: string;
            }) => (
              <div key={log.id} className={styles.activityItem}>
                <div className={styles.activityDot} />
                <div className={styles.activityContent}>
                  <span className={styles.activityText}>
                    <strong>{log.userName}</strong> {log.action.toLowerCase().replace('_', ' ')}{' '}
                    {log.entityType}
                  </span>
                  <span className={styles.activityTime}>{formatTime(log.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
