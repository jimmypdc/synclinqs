import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Download,
  Loader,
} from 'lucide-react';
import { fileUploadsApi, integrationsApi } from '../lib/api';
import styles from './FileUploadModal.module.css';

interface FileUploadModalProps {
  onClose: () => void;
}

interface UploadResult {
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  fileUploadId: string;
  recordCount: number;
  successCount: number;
  errorCount: number;
  errors?: Array<{ row: number; message: string }>;
}

export function FileUploadModal({ onClose }: FileUploadModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [integrationId, setIntegrationId] = useState<string>('');
  const [planId, setPlanId] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  // Fetch integrations for dropdown
  const { data: integrations } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => integrationsApi.list().then((r) => r.data),
  });

  // We'll need plans from somewhere - for now use a hardcoded approach
  // In real app, you'd have a plans API
  const [plans] = useState([
    { id: 'default', name: 'Default Plan' },
  ]);

  const uploadMutation = useMutation({
    mutationFn: (data: { integrationId: string; planId: string; fileContent: string; fileName: string }) =>
      fileUploadsApi.upload(data),
    onSuccess: (response) => {
      setUploadResult(response.data);
      queryClient.invalidateQueries({ queryKey: ['contributions'] });
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type === 'text/csv') {
      processFile(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setFileContent(content);
    };
    reader.readAsText(file);
  };

  const handleUpload = () => {
    if (!selectedFile || !fileContent || !integrationId) return;

    uploadMutation.mutate({
      integrationId,
      planId: planId || 'default',
      fileContent,
      fileName: selectedFile.name,
    });
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fileUploadsApi.getTemplate();
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contribution_template.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download template:', error);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setFileContent('');
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
              <Upload size={24} className={styles.headerIcon} />
              <div>
                <h2 className={styles.title}>Upload Contributions</h2>
                <p className={styles.subtitle}>Import contribution data from CSV file</p>
              </div>
            </div>
            <button onClick={onClose} className={styles.closeBtn}>
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className={styles.content}>
            {uploadResult ? (
              // Show result
              <div className={styles.resultSection}>
                <div className={`${styles.resultIcon} ${styles[uploadResult.status.toLowerCase()]}`}>
                  {uploadResult.status === 'COMPLETED' ? (
                    <CheckCircle size={48} />
                  ) : (
                    <AlertCircle size={48} />
                  )}
                </div>
                <h3 className={styles.resultTitle}>
                  {uploadResult.status === 'COMPLETED'
                    ? 'Upload Successful!'
                    : uploadResult.status === 'PARTIAL'
                    ? 'Partial Upload'
                    : 'Upload Failed'}
                </h3>
                <div className={styles.resultStats}>
                  <div className={styles.resultStat}>
                    <span className={styles.resultStatValue}>{uploadResult.recordCount}</span>
                    <span className={styles.resultStatLabel}>Total Records</span>
                  </div>
                  <div className={styles.resultStat}>
                    <span className={`${styles.resultStatValue} ${styles.success}`}>
                      {uploadResult.successCount}
                    </span>
                    <span className={styles.resultStatLabel}>Successful</span>
                  </div>
                  <div className={styles.resultStat}>
                    <span className={`${styles.resultStatValue} ${styles.error}`}>
                      {uploadResult.errorCount}
                    </span>
                    <span className={styles.resultStatLabel}>Errors</span>
                  </div>
                </div>
                {uploadResult.errors && uploadResult.errors.length > 0 && (
                  <div className={styles.errorList}>
                    <h4>Errors:</h4>
                    <ul>
                      {uploadResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>
                          Row {err.row}: {err.message}
                        </li>
                      ))}
                      {uploadResult.errors.length > 5 && (
                        <li>...and {uploadResult.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
                <div className={styles.resultActions}>
                  <button onClick={resetForm} className={styles.secondaryBtn}>
                    Upload Another
                  </button>
                  <button onClick={onClose} className={styles.primaryBtn}>
                    Done
                  </button>
                </div>
              </div>
            ) : (
              // Show upload form
              <>
                {/* Drop zone */}
                <div
                  className={`${styles.dropZone} ${isDragging ? styles.dragging : ''} ${
                    selectedFile ? styles.hasFile : ''
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className={styles.fileInput}
                  />
                  {selectedFile ? (
                    <div className={styles.selectedFile}>
                      <FileText size={32} className={styles.fileIcon} />
                      <div className={styles.fileInfo}>
                        <span className={styles.fileName}>{selectedFile.name}</span>
                        <span className={styles.fileSize}>
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          resetForm();
                        }}
                        className={styles.removeFileBtn}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className={styles.dropContent}>
                      <Upload size={32} className={styles.uploadIcon} />
                      <span className={styles.dropText}>
                        Drop CSV file here or click to browse
                      </span>
                      <span className={styles.dropHint}>Maximum file size: 5MB</span>
                    </div>
                  )}
                </div>

                {/* Options */}
                <div className={styles.options}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Integration</label>
                    <select
                      value={integrationId}
                      onChange={(e) => setIntegrationId(e.target.value)}
                      className={styles.select}
                      required
                    >
                      <option value="">Select integration...</option>
                      {integrations?.map((int: { id: string; name: string }) => (
                        <option key={int.id} value={int.id}>
                          {int.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Plan</label>
                    <select
                      value={planId}
                      onChange={(e) => setPlanId(e.target.value)}
                      className={styles.select}
                    >
                      <option value="">Default Plan</option>
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Template download */}
                <button onClick={handleDownloadTemplate} className={styles.templateBtn}>
                  <Download size={16} />
                  Download CSV Template
                </button>

                {/* Actions */}
                <div className={styles.actions}>
                  <button onClick={onClose} className={styles.cancelBtn}>
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    className={styles.uploadBtn}
                    disabled={!selectedFile || !integrationId || uploadMutation.isPending}
                  >
                    {uploadMutation.isPending ? (
                      <>
                        <Loader size={18} className={styles.spinner} />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload size={18} />
                        Upload & Process
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
