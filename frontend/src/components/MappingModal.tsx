import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { X, GitMerge, ArrowRight } from 'lucide-react';
import { mappingsApi, fieldDefinitionsApi } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import styles from './MappingModal.module.css';

interface MappingModalProps {
  mapping?: {
    id: string;
    name: string;
    sourceSystem: string;
    destinationSystem: string;
    mappingType: string;
  };
  onClose: () => void;
}

export function MappingModal({ mapping, onClose }: MappingModalProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const isEditing = !!mapping;

  const [formData, setFormData] = useState({
    name: mapping?.name ?? '',
    sourceSystem: mapping?.sourceSystem ?? '',
    destinationSystem: mapping?.destinationSystem ?? '',
    mappingType: mapping?.mappingType ?? 'contribution',
  });

  const { data: systemsData } = useQuery({
    queryKey: ['field-definition-systems'],
    queryFn: () => fieldDefinitionsApi.getSystems().then((r) => r.data),
  });

  const systems = systemsData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (data: typeof formData & { mappingRules: Record<string, unknown> }) =>
      mappingsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mappings'] });
      toast.success('Mapping created successfully');
      onClose();
    },
    onError: () => toast.error('Failed to create mapping'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string }) =>
      mappingsApi.update(mapping!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mappings'] });
      toast.success('Mapping updated successfully');
      onClose();
    },
    onError: () => toast.error('Failed to update mapping'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      updateMutation.mutate({ name: formData.name });
    } else {
      createMutation.mutate({
        ...formData,
        mappingRules: { field_mappings: [], conditional_mappings: [], calculated_fields: [] },
      });
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
            <GitMerge size={20} />
          </div>
          <div>
            <h2 className={styles.title}>
              {isEditing ? 'Edit Mapping' : 'Create Mapping'}
            </h2>
            <p className={styles.subtitle}>
              {isEditing
                ? 'Update mapping configuration'
                : 'Configure a new field mapping between systems'}
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Mapping Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., ADP to Fidelity Contributions"
              className={styles.input}
              required
            />
          </div>

          {!isEditing && (
            <>
              <div className={styles.systemsRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Source System</label>
                  <select
                    value={formData.sourceSystem}
                    onChange={(e) => setFormData({ ...formData, sourceSystem: e.target.value })}
                    className={styles.select}
                    required
                  >
                    <option value="">Select source...</option>
                    {systems.map((system: string) => (
                      <option key={system} value={system}>{system}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.arrowWrapper}>
                  <ArrowRight size={20} />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Destination System</label>
                  <select
                    value={formData.destinationSystem}
                    onChange={(e) => setFormData({ ...formData, destinationSystem: e.target.value })}
                    className={styles.select}
                    required
                  >
                    <option value="">Select destination...</option>
                    {systems.map((system: string) => (
                      <option key={system} value={system}>{system}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Mapping Type</label>
                <select
                  value={formData.mappingType}
                  onChange={(e) => setFormData({ ...formData, mappingType: e.target.value })}
                  className={styles.select}
                  required
                >
                  <option value="contribution">Contributions</option>
                  <option value="employee">Employees</option>
                  <option value="election">Deferral Elections</option>
                  <option value="loan">Loans</option>
                </select>
              </div>
            </>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn} disabled={isPending}>
              {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Mapping'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
