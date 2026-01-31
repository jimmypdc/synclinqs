import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  GitMerge,
  Play,
  Pause,
  Trash2,
  Settings,
  ArrowRight,
  TestTube,
  History,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { mappingsApi, fieldDefinitionsApi } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import styles from './MappingDetail.module.css';

interface FieldMapping {
  sourceField: string;
  destinationField: string;
  transformation?: string;
  required: boolean;
}

interface MappingLog {
  id: string;
  executionStart: string;
  executionEnd: string;
  recordsProcessed: number;
  recordsSuccessful: number;
  recordsFailed: number;
}

export function MappingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm } = useConfirm();
  const [testData, setTestData] = useState('');
  const [testResult, setTestResult] = useState<Record<string, unknown>[] | null>(null);

  const { data: mappingData, isLoading } = useQuery({
    queryKey: ['mapping', id],
    queryFn: () => mappingsApi.getById(id!).then((r) => r.data),
    enabled: !!id,
  });

  const { data: logsData } = useQuery({
    queryKey: ['mapping-logs', id],
    queryFn: () => mappingsApi.getLogs(id!, { limit: 10 }).then((r) => r.data),
    enabled: !!id,
  });

  const { data: sourceFieldsData } = useQuery({
    queryKey: ['field-definitions', mappingData?.data?.sourceSystem],
    queryFn: () => fieldDefinitionsApi.list({ system: mappingData?.data?.sourceSystem }).then((r) => r.data),
    enabled: !!mappingData?.data?.sourceSystem,
  });

  const { data: destFieldsData } = useQuery({
    queryKey: ['field-definitions', mappingData?.data?.destinationSystem],
    queryFn: () => fieldDefinitionsApi.list({ system: mappingData?.data?.destinationSystem }).then((r) => r.data),
    enabled: !!mappingData?.data?.destinationSystem,
  });

  const activateMutation = useMutation({
    mutationFn: () => mappingsApi.activate(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mapping', id] });
      toast.success('Mapping activated');
    },
    onError: () => toast.error('Failed to activate mapping'),
  });

  const deactivateMutation = useMutation({
    mutationFn: () => mappingsApi.deactivate(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mapping', id] });
      toast.success('Mapping deactivated');
    },
    onError: () => toast.error('Failed to deactivate mapping'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => mappingsApi.delete(id!),
    onSuccess: () => {
      toast.success('Mapping deleted');
      navigate('/mappings');
    },
    onError: () => toast.error('Failed to delete mapping'),
  });

  const testMutation = useMutation({
    mutationFn: (sampleData: Record<string, unknown>[]) => mappingsApi.test(id!, sampleData),
    onSuccess: (response) => {
      setTestResult(response.data?.data?.output ?? []);
      toast.success('Test completed');
    },
    onError: () => toast.error('Test failed'),
  });

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete Mapping',
      message: 'Are you sure you want to delete this mapping? This action cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (confirmed) {
      deleteMutation.mutate();
    }
  };

  const handleTest = () => {
    try {
      const parsed = JSON.parse(testData);
      const dataArray = Array.isArray(parsed) ? parsed : [parsed];
      testMutation.mutate(dataArray);
    } catch {
      toast.error('Invalid JSON data');
    }
  };

  const mapping = mappingData?.data;
  const fieldMappings: FieldMapping[] = mapping?.mappingRules?.field_mappings ?? [];
  const logs: MappingLog[] = logsData?.data ?? [];
  // Field definitions loaded for future visual field mapper
  const _sourceFields = sourceFieldsData?.data ?? [];
  const _destFields = destFieldsData?.data ?? [];
  void _sourceFields; void _destFields;

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className="loading-spinner" />
        <span>Loading mapping...</span>
      </div>
    );
  }

  if (!mapping) {
    return (
      <div className={styles.notFound}>
        <h2>Mapping not found</h2>
        <button onClick={() => navigate('/mappings')}>Back to Mappings</button>
      </div>
    );
  }

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/mappings')}>
          <ArrowLeft size={18} />
          Back
        </button>
        <div className={styles.headerContent}>
          <div className={styles.headerIcon}>
            <GitMerge size={24} />
          </div>
          <div>
            <h1 className={styles.title}>{mapping.name}</h1>
            <div className={styles.meta}>
              <span className={styles.systemBadge}>{mapping.sourceSystem}</span>
              <ArrowRight size={14} />
              <span className={styles.systemBadge}>{mapping.destinationSystem}</span>
              <span className={`${styles.statusBadge} ${mapping.isActive ? styles.active : styles.inactive}`}>
                <span className={`status-dot ${mapping.isActive ? 'active' : 'inactive'}`} />
                {mapping.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>
        <div className={styles.headerActions}>
          {mapping.isActive ? (
            <button
              className={styles.actionBtn}
              onClick={() => deactivateMutation.mutate()}
              disabled={deactivateMutation.isPending}
            >
              <Pause size={16} />
              Deactivate
            </button>
          ) : (
            <button
              className={`${styles.actionBtn} ${styles.primary}`}
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
            >
              <Play size={16} />
              Activate
            </button>
          )}
          <button className={`${styles.actionBtn} ${styles.danger}`} onClick={handleDelete}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {/* Field Mappings */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <Settings size={18} />
            <h2>Field Mappings</h2>
            <span className={styles.count}>{fieldMappings.length} fields</span>
          </div>
          <div className={styles.mappingsTable}>
            {fieldMappings.length === 0 ? (
              <div className={styles.emptyMappings}>
                <p>No field mappings configured yet.</p>
                <p className={styles.hint}>
                  Define mappings to transform data between {mapping.sourceSystem} and {mapping.destinationSystem}.
                </p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Source Field</th>
                    <th></th>
                    <th>Destination Field</th>
                    <th>Transformation</th>
                    <th>Required</th>
                  </tr>
                </thead>
                <tbody>
                  {fieldMappings.map((fm, index) => (
                    <tr key={index}>
                      <td><code>{fm.sourceField}</code></td>
                      <td><ArrowRight size={14} className={styles.arrowIcon} /></td>
                      <td><code>{fm.destinationField}</code></td>
                      <td>
                        {fm.transformation ? (
                          <span className={styles.transformBadge}>{fm.transformation}</span>
                        ) : (
                          <span className={styles.noTransform}>Direct</span>
                        )}
                      </td>
                      <td>
                        {fm.required ? (
                          <CheckCircle size={16} className={styles.requiredYes} />
                        ) : (
                          <span className={styles.requiredNo}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Test Panel */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <TestTube size={18} />
            <h2>Test Mapping</h2>
          </div>
          <div className={styles.testPanel}>
            <div className={styles.testInput}>
              <label>Sample Data (JSON)</label>
              <textarea
                value={testData}
                onChange={(e) => setTestData(e.target.value)}
                placeholder={`{\n  "employee_ssn": "123-45-6789",\n  "gross_pay": 5000,\n  "deferral_pct": 6\n}`}
                rows={8}
              />
              <button
                className={styles.testBtn}
                onClick={handleTest}
                disabled={!testData.trim() || testMutation.isPending}
              >
                <Play size={14} />
                {testMutation.isPending ? 'Testing...' : 'Run Test'}
              </button>
            </div>
            {testResult && (
              <div className={styles.testOutput}>
                <label>Output</label>
                <pre>{JSON.stringify(testResult, null, 2)}</pre>
              </div>
            )}
          </div>
        </section>

        {/* Execution Logs */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <History size={18} />
            <h2>Recent Executions</h2>
          </div>
          <div className={styles.logsTable}>
            {logs.length === 0 ? (
              <div className={styles.emptyLogs}>
                <p>No executions yet</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Duration</th>
                    <th>Processed</th>
                    <th>Success</th>
                    <th>Failed</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const duration = log.executionEnd
                      ? Math.round((new Date(log.executionEnd).getTime() - new Date(log.executionStart).getTime()) / 1000)
                      : null;
                    const success = log.recordsFailed === 0;
                    return (
                      <tr key={log.id}>
                        <td>{new Date(log.executionStart).toLocaleString()}</td>
                        <td>{duration ? `${duration}s` : '-'}</td>
                        <td>{log.recordsProcessed}</td>
                        <td className={styles.successCount}>{log.recordsSuccessful}</td>
                        <td className={log.recordsFailed > 0 ? styles.failCount : ''}>
                          {log.recordsFailed}
                        </td>
                        <td>
                          {success ? (
                            <CheckCircle size={16} className={styles.successIcon} />
                          ) : (
                            <XCircle size={16} className={styles.failIcon} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </motion.div>
  );
}
