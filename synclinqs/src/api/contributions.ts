import { apiClient } from './client';
import type { Contribution, PaginatedResponse } from '../types';

interface ContributionFilters {
  page?: number;
  limit?: number;
  status?: string;
  employeeId?: string;
  startDate?: string;
  endDate?: string;
}

interface CreateContributionData {
  employeeId: string;
  planId: string;
  payrollDate: string;
  employeePreTax: number;
  employeeRoth?: number;
  employerMatch?: number;
  employerNonMatch?: number;
  loanRepayment?: number;
}

interface UpdateContributionData {
  employeePreTax?: number;
  employeeRoth?: number;
  employerMatch?: number;
  employerNonMatch?: number;
  loanRepayment?: number;
  status?: 'PENDING' | 'VALIDATED' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED';
}

interface YtdTotals {
  employeePreTax: number;
  employeeRoth: number;
  employerMatch: number;
  employerNonMatch: number;
  loanRepayment: number;
  total: number;
}

export const contributionsApi = {
  async list(filters?: ContributionFilters): Promise<PaginatedResponse<Contribution>> {
    const { data } = await apiClient.get('/contributions', { params: filters });
    return data;
  },

  async getById(id: string): Promise<Contribution> {
    const { data } = await apiClient.get(`/contributions/${id}`);
    return data;
  },

  async create(contributionData: CreateContributionData): Promise<Contribution> {
    const { data } = await apiClient.post('/contributions', contributionData);
    return data;
  },

  async update(id: string, updates: UpdateContributionData): Promise<Contribution> {
    const { data } = await apiClient.patch(`/contributions/${id}`, updates);
    return data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/contributions/${id}`);
  },

  async getYtdTotals(employeeId: string): Promise<YtdTotals> {
    const { data } = await apiClient.get(`/contributions/ytd/${employeeId}`);
    return data;
  },

  async validate(contributions: CreateContributionData[]): Promise<{
    valid: boolean;
    errors: Array<{ index: number; errors: string[] }>;
  }> {
    const { data } = await apiClient.post('/contributions/validate', { contributions });
    return data;
  },
};
