import { apiClient } from './client';
import type { Integration } from '../types';

interface CreateIntegrationData {
  name: string;
  type: 'SFTP' | 'REST_API' | 'SOAP' | 'WEBHOOK';
  config: Record<string, unknown>;
}

interface UpdateIntegrationData {
  name?: string;
  config?: Record<string, unknown>;
  status?: 'ACTIVE' | 'INACTIVE';
}

interface SyncJob {
  jobId: string;
  integrationId: string;
  status: string;
  queuedAt: string;
}

export const integrationsApi = {
  async list(): Promise<Integration[]> {
    const { data } = await apiClient.get('/integrations');
    return data;
  },

  async getById(id: string): Promise<Integration> {
    const { data } = await apiClient.get(`/integrations/${id}`);
    return data;
  },

  async create(integrationData: CreateIntegrationData): Promise<Integration> {
    const { data } = await apiClient.post('/integrations', integrationData);
    return data;
  },

  async update(id: string, updates: UpdateIntegrationData): Promise<Integration> {
    const { data } = await apiClient.patch(`/integrations/${id}`, updates);
    return data;
  },

  async triggerSync(integrationId?: string): Promise<{ jobs: SyncJob[] }> {
    const { data } = await apiClient.post('/integrations/sync', { integrationId });
    return data;
  },

  async getStatus(): Promise<{
    integrations: Integration[];
    pendingJobs: number;
    failedJobs: number;
  }> {
    const { data } = await apiClient.get('/integrations/status');
    return data;
  },
};
