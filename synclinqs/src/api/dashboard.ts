import { apiClient } from './client';
import type {
  DashboardStats,
  ContributionSummary,
  ContributionTrend,
  SyncStatus,
  AuditLog,
} from '../types';

export const dashboardApi = {
  async getStats(): Promise<DashboardStats> {
    const { data } = await apiClient.get('/dashboard/stats');
    return data;
  },

  async getContributionSummary(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ContributionSummary> {
    const { data } = await apiClient.get('/dashboard/contributions/summary', { params });
    return data;
  },

  async getContributionTrends(params?: { months?: number }): Promise<ContributionTrend[]> {
    const { data } = await apiClient.get('/dashboard/contributions/trends', { params });
    return data;
  },

  async getSyncStatus(): Promise<SyncStatus> {
    const { data } = await apiClient.get('/dashboard/sync-status');
    return data;
  },

  async getAuditLogs(params?: {
    page?: number;
    limit?: number;
    action?: string;
    entityType?: string;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    const { data } = await apiClient.get('/dashboard/audit-logs', { params });
    return data;
  },
};
