import { prisma } from '../lib/prisma.js';
import { createError } from '../api/middleware/errorHandler.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { AuditService } from './audit.service.js';
import { logger } from '../utils/logger.js';
import { addSyncJob } from '../workers/queues.js';
import { SyncJobData, IntegrationType } from '../workers/types.js';
import { v4 as uuidv4 } from 'uuid';

interface CreateIntegrationData {
  name: string;
  type: 'SFTP' | 'REST_API' | 'SOAP' | 'WEBHOOK';
  config: Record<string, unknown>;
}

interface UpdateIntegrationData {
  name?: string;
  config?: Record<string, unknown>;
  status?: 'ACTIVE' | 'INACTIVE' | 'ERROR';
}

export class IntegrationsService {
  private auditService = new AuditService();

  async create(data: CreateIntegrationData, organizationId: string, userId: string) {
    const integration = await prisma.integration.create({
      data: {
        organizationId,
        name: data.name,
        type: data.type,
        configEncrypted: encrypt(JSON.stringify(data.config)),
        createdBy: userId,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entityType: 'Integration',
      entityId: integration.id,
      newValues: { name: data.name, type: data.type },
    });

    return this.formatIntegration(integration);
  }

  async list(organizationId: string) {
    const integrations = await prisma.integration.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: 'asc' },
    });

    return integrations.map((i) => this.formatIntegration(i));
  }

  async getById(id: string, organizationId: string) {
    const integration = await prisma.integration.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    if (!integration) {
      throw createError('Integration not found', 404, 'NOT_FOUND');
    }

    return this.formatIntegration(integration, true);
  }

  async update(id: string, data: UpdateIntegrationData, userId: string) {
    const existing = await prisma.integration.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw createError('Integration not found', 404, 'NOT_FOUND');
    }

    const updateData: Record<string, unknown> = { updatedBy: userId };

    if (data.name) updateData.name = data.name;
    if (data.status) updateData.status = data.status;
    if (data.config) updateData.configEncrypted = encrypt(JSON.stringify(data.config));

    const integration = await prisma.integration.update({
      where: { id },
      data: updateData,
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entityType: 'Integration',
      entityId: id,
      newValues: { name: data.name, status: data.status },
    });

    return this.formatIntegration(integration);
  }

  async triggerSync(integrationId: string | undefined, organizationId: string, userId: string) {
    const where: Record<string, unknown> = {
      organizationId,
      status: 'ACTIVE',
      deletedAt: null,
    };

    if (integrationId) {
      where.id = integrationId;
    }

    const integrations = await prisma.integration.findMany({ where });

    if (integrations.length === 0) {
      throw createError('No active integrations found', 404, 'NOT_FOUND');
    }

    // Queue sync jobs for each integration using BullMQ
    const triggeredAt = new Date().toISOString();
    const syncJobs = await Promise.all(
      integrations.map(async (integration) => {
        const idempotencyKey = `sync:${integration.id}:${uuidv4()}`;
        const jobData: SyncJobData = {
          integrationId: integration.id,
          organizationId,
          integrationType: integration.type as IntegrationType,
          triggeredBy: userId,
          triggeredAt,
          idempotencyKey,
        };

        const jobId = await addSyncJob(integration.type as IntegrationType, jobData);

        // Log sync queued event
        await this.auditService.log({
          userId,
          action: 'SYNC_QUEUED',
          entityType: 'Integration',
          entityId: integration.id,
          newValues: {
            jobId,
            integrationType: integration.type,
            idempotencyKey,
          },
        });

        return {
          integrationId: integration.id,
          integrationType: integration.type,
          jobId,
          status: 'queued',
          queuedAt: triggeredAt,
        };
      })
    );

    logger.info('Sync triggered', { count: syncJobs.length, organizationId, userId });

    return {
      message: `Sync queued for ${syncJobs.length} integration(s)`,
      jobs: syncJobs,
    };
  }

  async getStatus(organizationId: string) {
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

    return integrations;
  }

  private formatIntegration(
    integration: {
      id: string;
      name: string;
      type: string;
      status: string;
      configEncrypted: string;
      lastSyncAt: Date | null;
      lastSyncStatus: string | null;
      createdAt: Date;
    },
    includeConfig = false
  ) {
    return {
      id: integration.id,
      name: integration.name,
      type: integration.type,
      status: integration.status,
      lastSyncAt: integration.lastSyncAt,
      lastSyncStatus: integration.lastSyncStatus,
      createdAt: integration.createdAt,
      ...(includeConfig
        ? { config: JSON.parse(decrypt(integration.configEncrypted)) }
        : {}),
    };
  }
}
