import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  User,
  ChevronRightIcon,
  Download,
} from 'lucide-react';
import { employeesApi } from '../lib/api';
import { exportEmployees } from '../utils/export';
import { useToast } from '../contexts/ToastContext';
import styles from './Employees.module.css';

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  ssnLast4: string;
  hireDate: string;
  status: string;
}

export function Employees() {
  const navigate = useNavigate();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 10;

  const handleExport = () => {
    if (employees.length === 0) {
      toast.warning('No employees to export');
      return;
    }
    exportEmployees(employees);
    toast.success(`Exported ${employees.length} employees to CSV`);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page, search],
    queryFn: () => employeesApi.list({ page, limit, search }).then((r) => r.data),
  });

  const employees = data?.data ?? [];
  const pagination = data?.pagination;

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'active';
      case 'TERMINATED':
        return 'error';
      case 'ON_LEAVE':
        return 'pending';
      default:
        return 'inactive';
    }
  };

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Employees</h1>
          <p className={styles.subtitle}>
            Manage plan participants and their information
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.exportBtn} onClick={handleExport}>
            <Download size={18} />
            Export CSV
          </button>
          <button className={styles.addBtn}>
            <Plus size={18} />
            Add Employee
          </button>
        </div>
      </div>

      {/* Search and filters */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search employees..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className={styles.searchInput}
          />
        </div>
        <div className={styles.filters}>
          <select className={styles.select}>
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="TERMINATED">Terminated</option>
            <option value="ON_LEAVE">On Leave</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Employee #</th>
              <th>SSN (Last 4)</th>
              <th>Hire Date</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6}>
                    <div className={styles.skeleton} />
                  </td>
                </tr>
              ))
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  <div className={styles.emptyState}>
                    <User size={32} />
                    <span>No employees found</span>
                  </div>
                </td>
              </tr>
            ) : (
              employees.map((employee: Employee, index: number) => (
                <motion.tr
                  key={employee.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate(`/employees/${employee.id}`)}
                  className={styles.clickableRow}
                >
                  <td>
                    <div className={styles.employeeCell}>
                      <div className={styles.avatar}>
                        {employee.firstName[0]}
                        {employee.lastName[0]}
                      </div>
                      <div className={styles.employeeInfo}>
                        <span className={styles.employeeName}>
                          {employee.firstName} {employee.lastName}
                        </span>
                        <span className={styles.employeeEmail}>
                          {employee.email || '—'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <code className={styles.mono}>{employee.employeeNumber}</code>
                  </td>
                  <td>
                    <code className={styles.mono}>•••{employee.ssnLast4}</code>
                  </td>
                  <td>
                    {new Date(employee.hireDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td>
                    <span
                      className={`${styles.status} ${styles[getStatusClass(employee.status)]}`}
                    >
                      <span className={`status-dot ${getStatusClass(employee.status)}`} />
                      {employee.status}
                    </span>
                  </td>
                  <td>
                    <ChevronRightIcon size={16} className={styles.rowChevron} />
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            Showing {(page - 1) * limit + 1}-
            {Math.min(page * limit, pagination.total)} of {pagination.total}
          </span>
          <div className={styles.paginationControls}>
            <button
              className={styles.paginationBtn}
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 ||
                  p === pagination.totalPages ||
                  Math.abs(p - page) <= 1
              )
              .map((p, i, arr) => (
                <span key={p}>
                  {i > 0 && arr[i - 1] !== p - 1 && (
                    <span className={styles.ellipsis}>...</span>
                  )}
                  <button
                    className={`${styles.paginationBtn} ${p === page ? styles.active : ''}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                </span>
              ))}
            <button
              className={styles.paginationBtn}
              disabled={page === pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
