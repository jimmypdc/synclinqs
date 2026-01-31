import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  GitMerge,
  Plus,
  Search,
  Filter,
  Play,
  Pause,
  ArrowRight,
  Sparkles,
  FileCode,
} from 'lucide-react';
import { mappingsApi, mappingTemplatesApi } from '../lib/api';
import { MappingModal } from '../components/MappingModal';
import { useToast } from '../contexts/ToastContext';
import styles from './Mappings.module.css';

interface Mapping {
  id: string;
  name: string;
  sourceSystem: string;
  destinationSystem: string;
  mappingType: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MappingTemplate {
  id: string;
  name: string;
  description: string;
  sourceSystem: string;
  destinationSystem: string;
  mappingType: string;
  usageCount: number;
  isVerified: boolean;
}

export function Mappings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: mappingsData, isLoading } = useQuery({
    queryKey: ['mappings', statusFilter],
    queryFn: () => mappingsApi.list({ status: statusFilter || undefined }).then((r) => r.data),
  });

  const { data: templatesData } = useQuery({
    queryKey: ['mapping-templates-popular'],
    queryFn: () => mappingTemplatesApi.getPopular(4).then((r) => r.data),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => mappingsApi.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mappings'] });
      toast.success('Mapping activated');
    },
    onError: () => toast.error('Failed to activate mapping'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => mappingsApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mappings'] });
      toast.success('Mapping deactivated');
    },
    onError: () => toast.error('Failed to deactivate mapping'),
  });

  const filteredMappings = mappingsData?.data?.filter((mapping: Mapping) =>
    mapping.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mapping.sourceSystem.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mapping.destinationSystem.toLowerCase().includes(searchTerm.toLowerCase())
  ) ?? [];

  const templates = templatesData?.data ?? [];

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Mappings</h1>
          <p className={styles.subtitle}>
            Configure field mappings between payroll and recordkeeper systems
          </p>
        </div>
        <button className={styles.createBtn} onClick={() => setShowModal(true)}>
          <Plus size={18} />
          Create Mapping
        </button>
      </div>

      {/* Templates Section */}
      {templates.length > 0 && (
        <section className={styles.templatesSection}>
          <div className={styles.sectionHeader}>
            <Sparkles size={18} className={styles.sectionIcon} />
            <h2 className={styles.sectionTitle}>Quick Start Templates</h2>
          </div>
          <div className={styles.templatesGrid}>
            {templates.map((template: MappingTemplate, index: number) => (
              <motion.div
                key={template.id}
                className={styles.templateCard}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => {
                  // TODO: Create from template
                  toast.info('Template selection coming soon');
                }}
              >
                <div className={styles.templateHeader}>
                  <FileCode size={20} className={styles.templateIcon} />
                  {template.isVerified && (
                    <span className={styles.verifiedBadge}>Verified</span>
                  )}
                </div>
                <h3 className={styles.templateName}>{template.name}</h3>
                <p className={styles.templateDesc}>{template.description}</p>
                <div className={styles.templateSystems}>
                  <span>{template.sourceSystem}</span>
                  <ArrowRight size={14} />
                  <span>{template.destinationSystem}</span>
                </div>
                <span className={styles.templateUsage}>
                  Used {template.usageCount} times
                </span>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.searchWrapper}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search mappings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <div className={styles.filterWrapper}>
          <Filter size={16} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Mappings Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Source</th>
              <th>Destination</th>
              <th>Type</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className={styles.skeletonRow}>
                  <td><div className={styles.skeleton} /></td>
                  <td><div className={styles.skeleton} /></td>
                  <td><div className={styles.skeleton} /></td>
                  <td><div className={styles.skeleton} /></td>
                  <td><div className={styles.skeleton} /></td>
                  <td><div className={styles.skeleton} /></td>
                </tr>
              ))
            ) : filteredMappings.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  <div className={styles.emptyState}>
                    <GitMerge size={48} />
                    <h3>No mappings found</h3>
                    <p>Create a mapping to transform data between systems</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredMappings.map((mapping: Mapping, index: number) => (
                <motion.tr
                  key={mapping.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate(`/mappings/${mapping.id}`)}
                  className={styles.clickableRow}
                >
                  <td>
                    <div className={styles.mappingName}>
                      <GitMerge size={16} />
                      <span>{mapping.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className={styles.systemBadge}>{mapping.sourceSystem}</span>
                  </td>
                  <td>
                    <span className={styles.systemBadge}>{mapping.destinationSystem}</span>
                  </td>
                  <td>
                    <span className={styles.typeBadge}>{mapping.mappingType}</span>
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${mapping.isActive ? styles.active : styles.inactive}`}>
                      <span className={`status-dot ${mapping.isActive ? 'active' : 'inactive'}`} />
                      {mapping.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
                      {mapping.isActive ? (
                        <button
                          className={styles.actionBtn}
                          onClick={() => deactivateMutation.mutate(mapping.id)}
                          title="Deactivate"
                        >
                          <Pause size={14} />
                        </button>
                      ) : (
                        <button
                          className={`${styles.actionBtn} ${styles.primary}`}
                          onClick={() => activateMutation.mutate(mapping.id)}
                          title="Activate"
                        >
                          <Play size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Mapping Modal */}
      {showModal && (
        <MappingModal onClose={() => setShowModal(false)} />
      )}
    </motion.div>
  );
}
