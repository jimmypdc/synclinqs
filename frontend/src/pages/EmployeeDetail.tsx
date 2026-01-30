import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  User,
  Mail,
  Calendar,
  Hash,
  Shield,
  DollarSign,
  Percent,
  Save,
  Edit2,
  X,
} from 'lucide-react';
import { employeesApi, contributionsApi, electionsApi } from '../lib/api';
import styles from './EmployeeDetail.module.css';

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  ssnLast4: string;
  hireDate: string;
  terminationDate: string | null;
  status: string;
  planId: string;
}

interface Contribution {
  id: string;
  payrollDate: string;
  employeePreTax: number;
  employeeRoth: number;
  employerMatch: number;
  employerNonMatch: number;
  status: string;
}

interface DeferralElection {
  id: string;
  preTaxPercent: number;
  rothPercent: number;
  catchUpPercent: number;
  effectiveDate: string;
  status: string;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatPercent(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2)}%`;
}

export function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    status: '',
  });

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeesApi.getById(id!).then((r) => r.data),
    enabled: !!id,
  });

  const { data: contributionsData } = useQuery({
    queryKey: ['employee-contributions', id],
    queryFn: () => contributionsApi.list({ employeeId: id, limit: 10 }).then((r) => r.data),
    enabled: !!id,
  });

  const { data: electionsData } = useQuery({
    queryKey: ['employee-elections', id],
    queryFn: () => electionsApi.list({ employeeId: id }).then((r) => r.data),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { firstName?: string; lastName?: string; email?: string; status?: string }) =>
      employeesApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsEditing(false);
    },
  });

  const contributions = contributionsData?.data ?? [];
  const elections = electionsData?.data ?? [];
  const activeElection = elections.find((e: DeferralElection) => e.status === 'ACTIVE');

  const startEditing = () => {
    if (employee) {
      setEditForm({
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email || '',
        status: employee.status,
      });
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    updateMutation.mutate(editForm);
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'CONFIRMED':
        return 'active';
      case 'TERMINATED':
      case 'FAILED':
        return 'error';
      case 'ON_LEAVE':
      case 'PENDING':
      case 'VALIDATED':
        return 'pending';
      default:
        return 'inactive';
    }
  };

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Loading employee...</span>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className={styles.page}>
        <div className={styles.notFound}>
          <User size={48} />
          <h2>Employee not found</h2>
          <button onClick={() => navigate('/employees')} className={styles.backBtn}>
            <ArrowLeft size={18} />
            Back to Employees
          </button>
        </div>
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
        <button onClick={() => navigate('/employees')} className={styles.backLink}>
          <ArrowLeft size={18} />
          Back to Employees
        </button>
        <div className={styles.headerContent}>
          <div className={styles.avatar}>
            {employee.firstName[0]}
            {employee.lastName[0]}
          </div>
          <div className={styles.headerInfo}>
            {isEditing ? (
              <div className={styles.editNameRow}>
                <input
                  type="text"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  className={styles.editInput}
                  placeholder="First Name"
                />
                <input
                  type="text"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  className={styles.editInput}
                  placeholder="Last Name"
                />
              </div>
            ) : (
              <h1 className={styles.name}>
                {employee.firstName} {employee.lastName}
              </h1>
            )}
            <div className={styles.meta}>
              <span className={styles.metaItem}>
                <Hash size={14} />
                {employee.employeeNumber}
              </span>
              <span className={`${styles.status} ${styles[getStatusClass(employee.status)]}`}>
                <span className={`status-dot ${getStatusClass(employee.status)}`} />
                {isEditing ? (
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className={styles.editSelect}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="TERMINATED">Terminated</option>
                    <option value="ON_LEAVE">On Leave</option>
                    <option value="SUSPENDED">Suspended</option>
                  </select>
                ) : (
                  employee.status
                )}
              </span>
            </div>
          </div>
          <div className={styles.headerActions}>
            {isEditing ? (
              <>
                <button onClick={() => setIsEditing(false)} className={styles.cancelBtn}>
                  <X size={18} />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className={styles.saveBtn}
                  disabled={updateMutation.isPending}
                >
                  <Save size={18} />
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <button onClick={startEditing} className={styles.editBtn}>
                <Edit2 size={18} />
                Edit
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Details Card */}
        <motion.div
          className={styles.card}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className={styles.cardTitle}>Employee Details</h2>
          <div className={styles.detailsList}>
            <div className={styles.detailItem}>
              <Mail size={16} className={styles.detailIcon} />
              <span className={styles.detailLabel}>Email</span>
              {isEditing ? (
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className={styles.editInputSmall}
                  placeholder="email@example.com"
                />
              ) : (
                <span className={styles.detailValue}>{employee.email || '—'}</span>
              )}
            </div>
            <div className={styles.detailItem}>
              <Shield size={16} className={styles.detailIcon} />
              <span className={styles.detailLabel}>SSN (Last 4)</span>
              <span className={styles.detailValue}>•••{employee.ssnLast4}</span>
            </div>
            <div className={styles.detailItem}>
              <Calendar size={16} className={styles.detailIcon} />
              <span className={styles.detailLabel}>Hire Date</span>
              <span className={styles.detailValue}>
                {new Date(employee.hireDate).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
            {employee.terminationDate && (
              <div className={styles.detailItem}>
                <Calendar size={16} className={styles.detailIcon} />
                <span className={styles.detailLabel}>Termination Date</span>
                <span className={styles.detailValue}>
                  {new Date(employee.terminationDate).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Deferral Elections Card */}
        <motion.div
          className={styles.card}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className={styles.cardTitle}>
            <Percent size={18} />
            Current Deferral Election
          </h2>
          {activeElection ? (
            <div className={styles.electionGrid}>
              <div className={styles.electionItem}>
                <span className={styles.electionLabel}>Pre-Tax</span>
                <span className={styles.electionValue}>
                  {formatPercent(activeElection.preTaxPercent)}
                </span>
              </div>
              <div className={styles.electionItem}>
                <span className={styles.electionLabel}>Roth</span>
                <span className={styles.electionValue}>
                  {formatPercent(activeElection.rothPercent)}
                </span>
              </div>
              <div className={styles.electionItem}>
                <span className={styles.electionLabel}>Catch-Up</span>
                <span className={styles.electionValue}>
                  {formatPercent(activeElection.catchUpPercent)}
                </span>
              </div>
              <div className={styles.electionItem}>
                <span className={styles.electionLabel}>Effective</span>
                <span className={styles.electionValue}>
                  {new Date(activeElection.effectiveDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          ) : (
            <div className={styles.emptyElection}>
              <Percent size={24} />
              <span>No active deferral election</span>
            </div>
          )}
        </motion.div>

        {/* Recent Contributions Card */}
        <motion.div
          className={`${styles.card} ${styles.wideCard}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className={styles.cardTitle}>
            <DollarSign size={18} />
            Recent Contributions
          </h2>
          {contributions.length > 0 ? (
            <div className={styles.contributionsTable}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className={styles.alignRight}>Pre-Tax</th>
                    <th className={styles.alignRight}>Roth</th>
                    <th className={styles.alignRight}>Employer</th>
                    <th className={styles.alignRight}>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {contributions.map((c: Contribution) => (
                    <tr key={c.id}>
                      <td>
                        {new Date(c.payrollDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className={styles.alignRight}>{formatCurrency(c.employeePreTax)}</td>
                      <td className={styles.alignRight}>
                        {c.employeeRoth > 0 ? formatCurrency(c.employeeRoth) : '—'}
                      </td>
                      <td className={styles.alignRight}>
                        {formatCurrency(c.employerMatch + c.employerNonMatch)}
                      </td>
                      <td className={`${styles.alignRight} ${styles.totalAmount}`}>
                        {formatCurrency(
                          c.employeePreTax + c.employeeRoth + c.employerMatch + c.employerNonMatch
                        )}
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles[getStatusClass(c.status)]}`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyContributions}>
              <DollarSign size={24} />
              <span>No contributions found</span>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
