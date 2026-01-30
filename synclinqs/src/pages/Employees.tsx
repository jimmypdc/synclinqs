import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Search, Filter, MoreVertical, User } from 'lucide-react';
import { Header } from '../components/layout';
import {
  Button,
  Input,
  Card,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  TableEmpty,
  Badge,
  getStatusVariant,
} from '../components/ui';
import { employeesApi } from '../api';
import { formatDate } from '../utils/format';
import styles from './Employees.module.css';

export function EmployeesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['employees', { page, search, status: statusFilter }],
    queryFn: () =>
      employeesApi.list({
        page,
        limit: 10,
        search: search || undefined,
        status: statusFilter || undefined,
      }),
  });

  const employees = data?.data || [];
  const pagination = data?.pagination;

  return (
    <>
      <Header title="Employees" subtitle="Manage plan participants" />

      <div className={styles.content}>
        {/* Toolbar */}
        <motion.div
          className={styles.toolbar}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className={styles.searchFilters}>
            <div className={styles.searchWrapper}>
              <Input
                type="text"
                placeholder="Search employees..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search size={16} />}
              />
            </div>
            <div className={styles.filterGroup}>
              <Button
                variant={statusFilter === '' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter('')}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'ACTIVE' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter('ACTIVE')}
              >
                Active
              </Button>
              <Button
                variant={statusFilter === 'INACTIVE' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter('INACTIVE')}
              >
                Inactive
              </Button>
              <Button
                variant={statusFilter === 'TERMINATED' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter('TERMINATED')}
              >
                Terminated
              </Button>
            </div>
          </div>
          <div className={styles.actions}>
            <Button variant="ghost" size="sm" leftIcon={<Filter size={14} />}>
              Filters
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Plus size={14} />}>
              Add Employee
            </Button>
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card padding="none">
            <Table>
              <TableHead>
                <TableRow hoverable={false}>
                  <TableHeaderCell>Employee</TableHeaderCell>
                  <TableHeaderCell>Employee #</TableHeaderCell>
                  <TableHeaderCell>Email</TableHeaderCell>
                  <TableHeaderCell>Hire Date</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell align="right">Actions</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className={styles.skeletonRow}>
                          <div className="skeleton" style={{ width: 32, height: 32 }} />
                          <div className="skeleton" style={{ width: 120, height: 16 }} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="skeleton" style={{ width: 80, height: 16 }} />
                      </TableCell>
                      <TableCell>
                        <div className="skeleton" style={{ width: 160, height: 16 }} />
                      </TableCell>
                      <TableCell>
                        <div className="skeleton" style={{ width: 100, height: 16 }} />
                      </TableCell>
                      <TableCell>
                        <div className="skeleton" style={{ width: 60, height: 20 }} />
                      </TableCell>
                      <TableCell align="right">
                        <div className="skeleton" style={{ width: 24, height: 24, marginLeft: 'auto' }} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : employees.length === 0 ? (
                  <TableEmpty message="No employees found" colSpan={6} />
                ) : (
                  employees.map((employee, index) => (
                    <motion.tr
                      key={employee.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={styles.employeeRow}
                    >
                      <TableCell>
                        <div className={styles.employeeInfo}>
                          <div className={styles.avatar}>
                            <User size={16} />
                          </div>
                          <div className={styles.employeeName}>
                            <span className={styles.name}>
                              {employee.firstName} {employee.lastName}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={styles.employeeNumber}>{employee.employeeNumber}</span>
                      </TableCell>
                      <TableCell>
                        <span className={styles.email}>{employee.email}</span>
                      </TableCell>
                      <TableCell>
                        <span className={styles.date}>{formatDate(employee.hireDate)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(employee.status)} dot>
                          {employee.status}
                        </Badge>
                      </TableCell>
                      <TableCell align="right">
                        <button className={styles.actionButton}>
                          <MoreVertical size={16} />
                        </button>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </motion.div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>
              Showing {(page - 1) * pagination.limit + 1} to{' '}
              {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className={styles.paginationButtons}>
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className={styles.pageNumber}>
                {page} / {pagination.totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page === pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
