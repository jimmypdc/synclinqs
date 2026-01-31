import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Clock,
  Plus,
  Play,
  Pause,
  Settings,
  RefreshCw,
  CheckCircle,
  XCircle,
  Calendar,
  Trash2,
} from 'lucide-react';
import { jobsApi } from '../lib/api';
import { JobModal } from '../components/JobModal';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import styles from './Jobs.module.css';

interface Job {
  id: string;
  name: string;
  jobType: string;
  scheduleCron: string;
  timezone: string;
  sourceSystem: string | null;
  destinationSystem: string | null;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
}

interface JobExecution {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'partial';
  executionStart: string;
  executionEnd: string | null;
  recordsProcessed: number;
  recordsSuccessful: number;
  recordsFailed: number;
}

interface JobStats {
  total: number;
  active: number;
  successRate: number;
  avgDurationMs: number;
}

const jobTypeLabels: Record<string, string> = {
  contribution_sync: 'Contribution Sync',
  employee_sync: 'Employee Sync',
  reconciliation: 'Reconciliation',
  file_export: 'File Export',
};

export function Jobs() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm } = useConfirm();
  const [showModal, setShowModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [expandedJob] = useState<string | null>(null);

  const { data: jobsData, isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsApi.list().then((r) => r.data),
  });

  const { data: statsData } = useQuery({
    queryKey: ['job-stats'],
    queryFn: () => jobsApi.getStats().then((r) => r.data),
    refetchInterval: 30000,
  });

  const executeMutation = useMutation({
    mutationFn: (id: string) => jobsApi.execute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job execution started');
    },
    onError: () => toast.error('Failed to execute job'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      jobsApi.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job updated');
    },
    onError: () => toast.error('Failed to update job'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => jobsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job deleted');
    },
    onError: () => toast.error('Failed to delete job'),
  });

  const handleDelete = async (job: Job) => {
    const confirmed = await confirm({
      title: 'Delete Job',
      message: `Are you sure you want to delete "${job.name}"? This cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (confirmed) {
      deleteMutation.mutate(job.id);
    }
  };

  const jobs: Job[] = jobsData?.data ?? [];
  const stats: JobStats | null = statsData?.data ?? null;

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Scheduled Jobs</h1>
          <p className={styles.subtitle}>
            Automated sync and reconciliation tasks
          </p>
        </div>
        <button className={styles.createBtn} onClick={() => setShowModal(true)}>
          <Plus size={18} />
          Create Job
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.total}`}>
              <Clock size={20} />
            </div>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{stats.total}</span>
              <span className={styles.statLabel}>Total Jobs</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.active}`}>
              <Play size={20} />
            </div>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{stats.active}</span>
              <span className={styles.statLabel}>Active</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.success}`}>
              <CheckCircle size={20} />
            </div>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{(stats.successRate * 100).toFixed(0)}%</span>
              <span className={styles.statLabel}>Success Rate</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.duration}`}>
              <RefreshCw size={20} />
            </div>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{Math.round(stats.avgDurationMs / 1000)}s</span>
              <span className={styles.statLabel}>Avg Duration</span>
            </div>
          </div>
        </div>
      )}

      {/* Jobs Grid */}
      <div className={styles.jobsGrid}>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.jobCardSkeleton}>
              <div className={styles.skeletonIcon} />
              <div className={styles.skeletonContent}>
                <div className={styles.skeletonLine} />
                <div className={styles.skeletonLineShort} />
              </div>
            </div>
          ))
        ) : jobs.length === 0 ? (
          <div className={styles.emptyState}>
            <Clock size={48} />
            <h3>No scheduled jobs</h3>
            <p>Create a job to automate sync tasks</p>
          </div>
        ) : (
          jobs.map((job, index) => {
            const isExpanded = expandedJob === job.id;
            return (
              <motion.div
                key={job.id}
                className={styles.jobCard}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className={styles.cardHeader}>
                  <div className={`${styles.jobIcon} ${job.isActive ? styles.active : styles.inactive}`}>
                    <Clock size={20} />
                  </div>
                  <div className={styles.jobInfo}>
                    <h3 className={styles.jobName}>{job.name}</h3>
                    <span className={styles.jobType}>
                      {jobTypeLabels[job.jobType] || job.jobType}
                    </span>
                  </div>
                  <span className={`${styles.statusBadge} ${job.isActive ? styles.active : styles.inactive}`}>
                    <span className={`status-dot ${job.isActive ? 'active' : 'inactive'}`} />
                    {job.isActive ? 'Active' : 'Paused'}
                  </span>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.scheduleRow}>
                    <Calendar size={14} />
                    <span className={styles.cronValue}>{job.scheduleCron}</span>
                    <span className={styles.timezone}>{job.timezone}</span>
                  </div>

                  {job.nextRunAt && (
                    <div className={styles.nextRun}>
                      <span className={styles.nextRunLabel}>Next run:</span>
                      <span className={styles.nextRunValue}>
                        {new Date(job.nextRunAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}

                  {job.lastRunAt && (
                    <div className={styles.lastRun}>
                      <span className={styles.lastRunLabel}>Last run:</span>
                      <span className={styles.lastRunValue}>
                        {new Date(job.lastRunAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}
                </div>

                <div className={styles.cardFooter}>
                  <button
                    className={styles.actionBtn}
                    onClick={() => executeMutation.mutate(job.id)}
                    disabled={executeMutation.isPending}
                    title="Run now"
                  >
                    <Play size={14} />
                    Run
                  </button>
                  <button
                    className={styles.actionBtnSecondary}
                    onClick={() => updateMutation.mutate({
                      id: job.id,
                      isActive: !job.isActive
                    })}
                    title={job.isActive ? 'Pause' : 'Resume'}
                  >
                    {job.isActive ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button
                    className={styles.actionBtnSecondary}
                    onClick={() => {
                      setSelectedJob(job);
                      setShowModal(true);
                    }}
                    title="Edit"
                  >
                    <Settings size={14} />
                  </button>
                  <button
                    className={`${styles.actionBtnSecondary} ${styles.danger}`}
                    onClick={() => handleDelete(job)}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {isExpanded && (
                  <JobExecutions jobId={job.id} />
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Job Modal */}
      {showModal && (
        <JobModal
          job={selectedJob}
          onClose={() => {
            setShowModal(false);
            setSelectedJob(null);
          }}
        />
      )}
    </motion.div>
  );
}

function JobExecutions({ jobId }: { jobId: string }) {
  const { data: executionsData } = useQuery({
    queryKey: ['job-executions', jobId],
    queryFn: () => jobsApi.getExecutions(jobId, { limit: 5 }).then((r) => r.data),
  });

  const executions: JobExecution[] = executionsData?.data ?? [];

  if (executions.length === 0) return null;

  return (
    <div className={styles.executionsPanel}>
      <h4>Recent Executions</h4>
      <div className={styles.executionsList}>
        {executions.map((exec) => (
          <div key={exec.id} className={styles.executionItem}>
            <span className={`${styles.execStatus} ${styles[exec.status]}`}>
              {exec.status === 'completed' && <CheckCircle size={12} />}
              {exec.status === 'failed' && <XCircle size={12} />}
              {exec.status === 'running' && <RefreshCw size={12} className={styles.spinning} />}
              {exec.status}
            </span>
            <span className={styles.execRecords}>
              {exec.recordsSuccessful}/{exec.recordsProcessed}
            </span>
            <span className={styles.execTime}>
              {new Date(exec.executionStart).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
