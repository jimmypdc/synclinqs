import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Server,
  Globe,
  FileText,
  Webhook,
  Save,
  Loader,
} from 'lucide-react';
import { integrationsApi } from '../lib/api';
import styles from './IntegrationModal.module.css';

interface Integration {
  id: string;
  name: string;
  type: 'SFTP' | 'REST_API' | 'SOAP' | 'WEBHOOK';
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  config?: Record<string, unknown>;
}

interface IntegrationModalProps {
  integration?: Integration | null;
  onClose: () => void;
}

const typeIcons = {
  SFTP: Server,
  REST_API: Globe,
  SOAP: FileText,
  WEBHOOK: Webhook,
};

const typeLabels = {
  SFTP: 'SFTP',
  REST_API: 'REST API',
  SOAP: 'SOAP',
  WEBHOOK: 'Webhook',
};

const configFields: Record<string, { label: string; type: string; placeholder: string }[]> = {
  SFTP: [
    { label: 'Host', type: 'text', placeholder: 'sftp.example.com' },
    { label: 'Port', type: 'number', placeholder: '22' },
    { label: 'Username', type: 'text', placeholder: 'username' },
    { label: 'Password', type: 'password', placeholder: '••••••••' },
    { label: 'Directory', type: 'text', placeholder: '/incoming/contributions' },
  ],
  REST_API: [
    { label: 'Base URL', type: 'url', placeholder: 'https://api.example.com/v1' },
    { label: 'Client ID', type: 'text', placeholder: 'client-id' },
    { label: 'Client Secret', type: 'password', placeholder: '••••••••' },
    { label: 'Auth URL', type: 'url', placeholder: 'https://auth.example.com/oauth/token' },
  ],
  SOAP: [
    { label: 'WSDL URL', type: 'url', placeholder: 'https://services.example.com/ws?wsdl' },
    { label: 'Username', type: 'text', placeholder: 'username' },
    { label: 'Password', type: 'password', placeholder: '••••••••' },
    { label: 'Endpoint', type: 'url', placeholder: 'https://services.example.com/endpoint' },
  ],
  WEBHOOK: [
    { label: 'Webhook URL', type: 'url', placeholder: 'https://example.com/webhook' },
    { label: 'Secret Key', type: 'password', placeholder: 'webhook-secret' },
    { label: 'Retry Count', type: 'number', placeholder: '3' },
  ],
};

export function IntegrationModal({ integration, onClose }: IntegrationModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!integration;

  const [formData, setFormData] = useState({
    name: '',
    type: 'SFTP' as 'SFTP' | 'REST_API' | 'SOAP' | 'WEBHOOK',
    status: 'INACTIVE' as 'ACTIVE' | 'INACTIVE' | 'ERROR',
    config: {} as Record<string, string>,
  });

  useEffect(() => {
    if (integration) {
      setFormData({
        name: integration.name,
        type: integration.type,
        status: integration.status,
        config: (integration.config as Record<string, string>) || {},
      });
    }
  }, [integration]);

  const createMutation = useMutation({
    mutationFn: (data: { name: string; type: 'SFTP' | 'REST_API' | 'SOAP' | 'WEBHOOK'; config: Record<string, unknown> }) =>
      integrationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; config?: Record<string, unknown>; status?: 'ACTIVE' | 'INACTIVE' | 'ERROR' }) =>
      integrationsApi.update(integration!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing) {
      updateMutation.mutate({
        name: formData.name,
        config: formData.config,
        status: formData.status,
      });
    } else {
      createMutation.mutate({
        name: formData.name,
        type: formData.type,
        config: formData.config,
      });
    }
  };

  const handleConfigChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      config: { ...prev.config, [field.toLowerCase().replace(/ /g, '')]: value },
    }));
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const Icon = typeIcons[formData.type];
  const fields = configFields[formData.type];

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={styles.modal}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerContent}>
              <div className={styles.headerIcon}>
                <Icon size={24} />
              </div>
              <div>
                <h2 className={styles.title}>
                  {isEditing ? 'Edit Integration' : 'Add Integration'}
                </h2>
                <p className={styles.subtitle}>
                  {isEditing ? `Configure ${integration.name}` : 'Connect to an external system'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className={styles.closeBtn}>
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Basic Info */}
            <div className={styles.section}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Integration Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My Integration"
                  className={styles.input}
                  required
                />
              </div>

              {!isEditing && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>Integration Type</label>
                  <div className={styles.typeGrid}>
                    {(Object.keys(typeIcons) as Array<keyof typeof typeIcons>).map((type) => {
                      const TypeIcon = typeIcons[type];
                      return (
                        <button
                          key={type}
                          type="button"
                          className={`${styles.typeBtn} ${formData.type === type ? styles.selected : ''}`}
                          onClick={() => setFormData({ ...formData, type, config: {} })}
                        >
                          <TypeIcon size={20} />
                          <span>{typeLabels[type]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {isEditing && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' | 'ERROR' })}
                    className={styles.select}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              )}
            </div>

            {/* Config Fields */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Connection Settings</h3>
              <div className={styles.configGrid}>
                {fields.map((field) => (
                  <div key={field.label} className={styles.formGroup}>
                    <label className={styles.label}>{field.label}</label>
                    <input
                      type={field.type}
                      value={formData.config[field.label.toLowerCase().replace(/ /g, '')] || ''}
                      onChange={(e) => handleConfigChange(field.label, e.target.value)}
                      placeholder={field.placeholder}
                      className={styles.input}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className={styles.actions}>
              <button type="button" onClick={onClose} className={styles.cancelBtn}>
                Cancel
              </button>
              <button type="submit" className={styles.submitBtn} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader size={18} className={styles.spinner} />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    {isEditing ? 'Save Changes' : 'Create Integration'}
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
