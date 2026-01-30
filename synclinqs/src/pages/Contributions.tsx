import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Search, Download, Calendar, DollarSign } from 'lucide-react';
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
  StatCard,
} from '../components/ui';
import { contributionsApi, dashboardApi } from '../api';
import { formatCurrency, formatDate } from '../utils/format';
import styles from './Contributions.module.css';

export function ContributionsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['contributions', { page, status: statusFilter }],
    queryFn: () =>
      contributionsApi.list({
        page,
        limit: 15,
        status: statusFilter || undefined,
      }),
  });

  const { data: summary } = useQuery({
    queryKey: ['contributions', 'summary'],
    queryFn: () => dashboardApi.getContributionSummary(),
  });

  const contributions = data?.data || [];
  const pagination = data?.pagination;

  const totalContributions = (c: typeof contributions[0]) =>
    c.employeePreTax + c.employeeRoth + c.employerMatch + c.employerNonMatch + c.loanRepayment;

  return (
    <>
      <Header title="Contributions" subtitle="401(k) contribution records" />

      <div className={styles.content}>
        {/* Summary Stats */}
        <section className={styles.summaryGrid}>
          <StatCard
            label="Total Pre-Tax"
            value={formatCurrency(summary?.totalEmployeePreTax || 0)}
            icon={DollarSign}
            variant="accent"
            delay={0}
          />
          <StatCard
            label="Total Roth"
            value={formatCurrency(summary?.totalEmployeeRoth || 0)}
            icon={DollarSign}
            variant="default"
            delay={0.05}
          />
          <StatCard
            label="Employer Match"
            value={formatCurrency(summary?.totalEmployerMatch || 0)}
            icon={DollarSign}
            variant="success"
            delay={0.1}
          />
          <StatCard
            label="Avg Contribution"
            value={formatCurrency(summary?.averageContribution || 0)}
            icon={DollarSign}
            variant="default"
            delay={0.15}
          />
        </section>

        {/* Toolbar */}
        <motion.div
          className={styles.toolbar}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className={styles.searchFilters}>
            <div className={styles.searchWrapper}>
              <Input
                type="text"
                placeholder="Search by employee..."
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
                variant={statusFilter === 'PENDING' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter('PENDING')}
              >
                Pending
              </Button>
              <Button
                variant={statusFilter === 'VALIDATED' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter('VALIDATED')}
              >
                Validated
              </Button>
              <Button
                variant={statusFilter === 'CONFIRMED' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter('CONFIRMED')}
              >
                Confirmed
              </Button>
            </div>
          </div>
          <div className={styles.actions}>
            <Button variant="ghost" size="sm" leftIcon={<Calendar size={14} />}>
              Date Range
            </Button>
            <Button variant="ghost" size="sm" leftIcon={<Download size={14} />}>
              Export
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Plus size={14} />}>
              Add Contribution
            </Button>
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card padding="none">
            <Table>
              <TableHead>
                <TableRow hoverable={false}>
                  <TableHeaderCell>Employee</TableHeaderCell>
                  <TableHeaderCell>Payroll Date</TableHeaderCell>
                  <TableHeaderCell align="right">Pre-Tax</TableHeaderCell>
                  <TableHeaderCell align="right">Roth</TableHeaderCell>
                  <TableHeaderCell align="right">Match</TableHeaderCell>
                  <TableHeaderCell align="right">Total</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="skeleton" style={{ width: 140, height: 16 }} />
                      </TableCell>
                      <TableCell>
                        <div className="skeleton" style={{ width: 100, height: 16 }} />
                      </TableCell>
                      <TableCell align="right">
                        <div className="skeleton" style={{ width: 70, height: 16, marginLeft: 'auto' }} />
                      </TableCell>
                      <TableCell align="right">
                        <div className="skeleton" style={{ width: 70, height: 16, marginLeft: 'auto' }} />
                      </TableCell>
                      <TableCell align="right">
                        <div className="skeleton" style={{ width: 70, height: 16, marginLeft: 'auto' }} />
                      </TableCell>
                      <TableCell align="right">
                        <div className="skeleton" style={{ width: 80, height: 16, marginLeft: 'auto' }} />
                      </TableCell>
                      <TableCell>
                        <div className="skeleton" style={{ width: 70, height: 20 }} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : contributions.length === 0 ? (
                  <TableEmpty message="No contributions found" colSpan={7} />
                ) : (
                  contributions.map((contribution, index) => (
                    <motion.tr
                      key={contribution.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className={styles.contributionRow}
                    >
                      <TableCell>
                        <div className={styles.employeeInfo}>
                          <span className={styles.employeeName}>
                            {contribution.employee?.firstName} {contribution.employee?.lastName}
                          </span>
                          <span className={styles.employeeNumber}>
                            {contribution.employee?.employeeNumber}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={styles.date}>{formatDate(contribution.payrollDate)}</span>
                      </TableCell>
                      <TableCell align="right" numeric>
                        <span className={styles.amount}>
                          {formatCurrency(contribution.employeePreTax)}
                        </span>
                      </TableCell>
                      <TableCell align="right" numeric>
                        <span className={`${styles.amount} ${contribution.employeeRoth === 0 ? styles.zero : ''}`}>
                          {formatCurrency(contribution.employeeRoth)}
                        </span>
                      </TableCell>
                      <TableCell align="right" numeric>
                        <span className={styles.amount}>
                          {formatCurrency(contribution.employerMatch)}
                        </span>
                      </TableCell>
                      <TableCell align="right" numeric>
                        <span className={styles.totalAmount}>
                          {formatCurrency(totalContributions(contribution))}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(contribution.status)} dot>
                          {contribution.status}
                        </Badge>
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
