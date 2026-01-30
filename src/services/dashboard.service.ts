import { prisma } from '../lib/prisma.js';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface ContributionSummary {
  totalContributions: number;
  employeePreTax: number;
  employeeRoth: number;
  employerMatch: number;
  employerNonMatch: number;
  loanRepayments: number;
  contributionCount: number;
  employeeCount: number;
}

interface SyncStatusSummary {
  total: number;
  active: number;
  inactive: number;
  error: number;
  lastSyncTimes: Array<{
    integrationId: string;
    name: string;
    type: string;
    lastSyncAt: Date | null;
    lastSyncStatus: string | null;
  }>;
}

interface AuditLogEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: Date;
}

export class DashboardService {
  /**
   * Get contribution summary for a date range
   */
  async getContributionSummary(organizationId: string, dateRange?: DateRange): Promise<ContributionSummary> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const start = dateRange?.startDate ?? startOfMonth;
    const end = dateRange?.endDate ?? endOfMonth;

    // Get employee IDs for this organization
    const employees = await prisma.employee.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true },
    });
    const employeeIds = employees.map((e) => e.id);

    // Get contribution aggregates
    const contributions = await prisma.contribution.aggregate({
      where: {
        employeeId: { in: employeeIds },
        payrollDate: { gte: start, lte: end },
        deletedAt: null,
      },
      _sum: {
        employeePreTax: true,
        employeeRoth: true,
        employerMatch: true,
        employerNonMatch: true,
        loanRepayment: true,
      },
      _count: true,
    });

    // Get unique employee count with contributions
    const employeesWithContributions = await prisma.contribution.groupBy({
      by: ['employeeId'],
      where: {
        employeeId: { in: employeeIds },
        payrollDate: { gte: start, lte: end },
        deletedAt: null,
      },
    });

    const preTax = contributions._sum.employeePreTax ?? 0;
    const roth = contributions._sum.employeeRoth ?? 0;
    const match = contributions._sum.employerMatch ?? 0;
    const nonMatch = contributions._sum.employerNonMatch ?? 0;
    const loans = contributions._sum.loanRepayment ?? 0;

    return {
      totalContributions: preTax + roth + match + nonMatch,
      employeePreTax: preTax,
      employeeRoth: roth,
      employerMatch: match,
      employerNonMatch: nonMatch,
      loanRepayments: loans,
      contributionCount: contributions._count,
      employeeCount: employeesWithContributions.length,
    };
  }

  /**
   * Get contribution trends by month
   */
  async getContributionTrends(organizationId: string, months: number = 6) {
    const employees = await prisma.employee.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true },
    });
    const employeeIds = employees.map((e) => e.id);

    const now = new Date();
    const trends: Array<{
      month: string;
      year: number;
      total: number;
      employeeContributions: number;
      employerContributions: number;
    }> = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const result = await prisma.contribution.aggregate({
        where: {
          employeeId: { in: employeeIds },
          payrollDate: { gte: startOfMonth, lte: endOfMonth },
          deletedAt: null,
        },
        _sum: {
          employeePreTax: true,
          employeeRoth: true,
          employerMatch: true,
          employerNonMatch: true,
        },
      });

      const employeeTotal = (result._sum.employeePreTax ?? 0) + (result._sum.employeeRoth ?? 0);
      const employerTotal = (result._sum.employerMatch ?? 0) + (result._sum.employerNonMatch ?? 0);

      trends.push({
        month: date.toLocaleString('en-US', { month: 'short' }),
        year: date.getFullYear(),
        total: employeeTotal + employerTotal,
        employeeContributions: employeeTotal,
        employerContributions: employerTotal,
      });
    }

    return trends;
  }

  /**
   * Get sync status summary for all integrations
   */
  async getSyncStatus(organizationId: string): Promise<SyncStatusSummary> {
    const integrations = await prisma.integration.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        lastSyncAt: true,
        lastSyncStatus: true,
      },
    });

    const statusCounts = {
      total: integrations.length,
      active: integrations.filter((i) => i.status === 'ACTIVE').length,
      inactive: integrations.filter((i) => i.status === 'INACTIVE').length,
      error: integrations.filter((i) => i.status === 'ERROR').length,
    };

    return {
      ...statusCounts,
      lastSyncTimes: integrations.map((i) => ({
        integrationId: i.id,
        name: i.name,
        type: i.type,
        lastSyncAt: i.lastSyncAt,
        lastSyncStatus: i.lastSyncStatus,
      })),
    };
  }

  /**
   * Get recent audit log entries
   */
  async getRecentAuditLogs(organizationId: string, limit: number = 20): Promise<AuditLogEntry[]> {
    // Get users in this organization
    const users = await prisma.user.findMany({
      where: { organizationId },
      select: { id: true, firstName: true, lastName: true },
    });
    const userIds = users.map((u) => u.id);
    const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    const logs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { userId: { in: userIds } },
          { userId: null }, // System actions
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      userName: log.userId ? userMap.get(log.userId) ?? null : 'System',
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      createdAt: log.createdAt,
    }));
  }

  /**
   * Get overall dashboard statistics
   */
  async getDashboardStats(organizationId: string) {
    const [
      employeeCount,
      activeEmployees,
      planCount,
      integrationCount,
      pendingContributions,
    ] = await Promise.all([
      prisma.employee.count({ where: { organizationId, deletedAt: null } }),
      prisma.employee.count({ where: { organizationId, status: 'ACTIVE', deletedAt: null } }),
      prisma.plan.count({ where: { organizationId, deletedAt: null } }),
      prisma.integration.count({ where: { organizationId, deletedAt: null } }),
      prisma.contribution.count({
        where: {
          employee: { organizationId },
          status: 'PENDING',
          deletedAt: null,
        },
      }),
    ]);

    // Get this month's contribution summary
    const contributionSummary = await this.getContributionSummary(organizationId);

    // Get sync status
    const syncStatus = await this.getSyncStatus(organizationId);

    return {
      employees: {
        total: employeeCount,
        active: activeEmployees,
        inactive: employeeCount - activeEmployees,
      },
      plans: planCount,
      integrations: {
        total: integrationCount,
        active: syncStatus.active,
        withErrors: syncStatus.error,
      },
      contributions: {
        pending: pendingContributions,
        thisMonth: {
          total: contributionSummary.totalContributions,
          count: contributionSummary.contributionCount,
          employees: contributionSummary.employeeCount,
        },
      },
    };
  }
}
