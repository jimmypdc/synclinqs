import { Job } from 'bullmq';
import { prisma } from '../../lib/prisma.js';
import { decrypt } from '../../utils/encryption.js';
import { AuditService } from '../../services/audit.service.js';
import { EmailService } from '../../services/email.service.js';
import { logger } from '../../utils/logger.js';
import { SyncJobData, SyncJobResult, IntegrationConfig, IntegrationType } from '../types.js';

export interface ProcessorContext {
  integrationId: string;
  organizationId: string;
  integrationType: IntegrationType;
  config: IntegrationConfig;
  triggeredBy: string;
}

export interface TypeProcessor {
  processSync(context: ProcessorContext): Promise<{ recordsProcessed: number }>;
}

const auditService = new AuditService();
const emailService = new EmailService();

export async function processJob(
  job: Job<SyncJobData, SyncJobResult>,
  typeProcessor: TypeProcessor
): Promise<SyncJobResult> {
  const { integrationId, organizationId, integrationType, triggeredBy, idempotencyKey } = job.data;

  logger.info('Starting sync job', {
    jobId: job.id,
    integrationId,
    integrationType,
    attempt: job.attemptsMade + 1,
  });

  // Log sync started
  await auditService.log({
    userId: triggeredBy,
    action: 'SYNC_STARTED',
    entityType: 'Integration',
    entityId: integrationId,
    newValues: {
      jobId: job.id,
      integrationType,
      idempotencyKey,
      attempt: job.attemptsMade + 1,
    },
  });

  try {
    // Fetch integration from database
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!integration) {
      throw new Error(`Integration not found: ${integrationId}`);
    }

    if (integration.status !== 'ACTIVE') {
      throw new Error(`Integration is not active: ${integration.status}`);
    }

    // Decrypt configuration
    const config = JSON.parse(decrypt(integration.configEncrypted)) as IntegrationConfig;

    // Update status to PROCESSING
    await prisma.integration.update({
      where: { id: integrationId },
      data: { lastSyncStatus: 'PROCESSING' },
    });

    // Create processor context
    const context: ProcessorContext = {
      integrationId,
      organizationId,
      integrationType,
      config,
      triggeredBy,
    };

    // Call type-specific processor
    const result = await typeProcessor.processSync(context);

    // Update integration with success
    const now = new Date();
    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        lastSyncAt: now,
        lastSyncStatus: 'SUCCESS',
      },
    });

    // Log sync completed
    await auditService.log({
      userId: triggeredBy,
      action: 'SYNC_COMPLETED',
      entityType: 'Integration',
      entityId: integrationId,
      newValues: {
        jobId: job.id,
        recordsProcessed: result.recordsProcessed,
        completedAt: now.toISOString(),
      },
    });

    logger.info('Sync job completed', {
      jobId: job.id,
      integrationId,
      recordsProcessed: result.recordsProcessed,
    });

    // Send success notification email
    const triggerUser = await prisma.user.findUnique({
      where: { id: triggeredBy },
      select: { email: true },
    });
    if (triggerUser) {
      const integrationForEmail = await prisma.integration.findUnique({
        where: { id: integrationId },
        select: { name: true },
      });
      await emailService.sendSyncNotification({
        recipientEmail: triggerUser.email,
        integrationName: integrationForEmail?.name ?? 'Unknown Integration',
        status: 'completed',
        syncedAt: now,
        recordsProcessed: result.recordsProcessed,
      }).catch((emailError) => {
        logger.error('Failed to send sync notification email', { error: String(emailError) });
      });
    }

    return {
      success: true,
      integrationId,
      recordsProcessed: result.recordsProcessed,
      completedAt: now.toISOString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Sync job failed', {
      jobId: job.id,
      integrationId,
      error: errorMessage,
      attempt: job.attemptsMade + 1,
    });

    // Update integration with failure status
    await prisma.integration
      .update({
        where: { id: integrationId },
        data: {
          lastSyncStatus: 'FAILED',
        },
      })
      .catch((updateError) => {
        logger.error('Failed to update integration status', {
          integrationId,
          error: updateError,
        });
      });

    // Log sync failed
    const willRetry = job.attemptsMade < (job.opts.attempts ?? 1) - 1;
    await auditService.log({
      userId: triggeredBy,
      action: 'SYNC_FAILED',
      entityType: 'Integration',
      entityId: integrationId,
      newValues: {
        jobId: job.id,
        error: errorMessage,
        attempt: job.attemptsMade + 1,
        willRetry,
      },
    });

    // Send failure notification email only on final failure (no more retries)
    if (!willRetry) {
      const triggerUser = await prisma.user.findUnique({
        where: { id: triggeredBy },
        select: { email: true },
      });
      if (triggerUser) {
        const integrationForEmail = await prisma.integration.findUnique({
          where: { id: integrationId },
          select: { name: true },
        });
        await emailService.sendSyncNotification({
          recipientEmail: triggerUser.email,
          integrationName: integrationForEmail?.name ?? 'Unknown Integration',
          status: 'failed',
          syncedAt: new Date(),
          errorMessage,
        }).catch((emailError) => {
          logger.error('Failed to send sync failure notification email', { error: String(emailError) });
        });
      }
    }

    // Re-throw to trigger BullMQ retry logic
    throw error;
  }
}
