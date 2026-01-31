import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { X, Clock } from 'lucide-react';
import { jobsApi } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import styles from './JobModal.module.css';

interface Job {
  id: string;
  name: string;
  jobType: string;
  scheduleCron: string;
  timezone: string;
  sourceSystem: string | null;
  destinationSystem: string | null;
  isActive: boolean;
}

interface JobModalProps {
  job?: Job | null;
  onClose: () => void;
}

const cronPresets = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at 6 AM', value: '0 6 * * *' },
  { label: 'Every Monday', value: '0 0 * * 1' },
  { label: 'First of month', value: '0 0 1 * *' },
];

export function JobModal({ job, onClose }: JobModalProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const isEditing = !!job;

  const [formData, setFormData] = useState({
    name: job?.name ?? '',
    jobType: job?.jobType ?? 'contribution_sync',
    scheduleCron: job?.scheduleCron ?? '0 6 * * *',
    timezone: job?.timezone ?? 'UTC',
    isActive: job?.isActive ?? true,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => jobsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-stats'] });
      toast.success('Job created successfully');
      onClose();
    },
    onError: () => toast.error('Failed to create job'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<typeof formData>) => jobsApi.update(job!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job updated successfully');
      onClose();
    },
    onError: () => toast.error('Failed to update job'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      updateMutation.mutate({
        name: formData.name,
        scheduleCron: formData.scheduleCron,
        isActive: formData.isActive,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.headerIcon}>
            <Clock size={20} />
          </div>
          <div>
            <h2 className={styles.title}>
              {isEditing ? 'Edit Job' : 'Create Job'}
            </h2>
            <p className={styles.subtitle}>
              {isEditing ? 'Update job configuration' : 'Configure a new scheduled job'}
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Job Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Daily Contribution Sync"
              className={styles.input}
              required
            />
          </div>

          {!isEditing && (
            <div className={styles.field}>
              <label className={styles.label}>Job Type</label>
              <select
                value={formData.jobType}
                onChange={(e) => setFormData({ ...formData, jobType: e.target.value })}
                className={styles.select}
                required
              >
                <option value="contribution_sync">Contribution Sync</option>
                <option value="employee_sync">Employee Sync</option>
                <option value="reconciliation">Reconciliation</option>
                <option value="file_export">File Export</option>
              </select>
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Schedule (Cron Expression)</label>
            <input
              type="text"
              value={formData.scheduleCron}
              onChange={(e) => setFormData({ ...formData, scheduleCron: e.target.value })}
              placeholder="0 6 * * *"
              className={styles.input}
              required
            />
            <div className={styles.cronPresets}>
              {cronPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`${styles.presetBtn} ${formData.scheduleCron === preset.value ? styles.active : ''}`}
                  onClick={() => setFormData({ ...formData, scheduleCron: preset.value })}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Timezone</label>
            <select
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              className={styles.select}
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern (ET)</option>
              <option value="America/Chicago">Central (CT)</option>
              <option value="America/Denver">Mountain (MT)</option>
              <option value="America/Los_Angeles">Pacific (PT)</option>
            </select>
          </div>

          <div className={styles.toggleField}>
            <label className={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              <span className={styles.toggleText}>Active</span>
            </label>
            <span className={styles.toggleHint}>Job will run automatically when active</span>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn} disabled={isPending}>
              {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Job'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
