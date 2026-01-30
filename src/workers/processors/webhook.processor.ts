import axios from 'axios';
import crypto from 'crypto';
import { ProcessorContext, TypeProcessor } from './base.processor.js';
import { WebhookConfig } from '../types.js';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../lib/prisma.js';

interface WebhookPayload {
  event: string;
  timestamp: string;
  organizationId: string;
  data: unknown;
}

export class WebhookProcessor implements TypeProcessor {
  async processSync(context: ProcessorContext): Promise<{ recordsProcessed: number }> {
    const config = context.config as WebhookConfig;
    let recordsProcessed = 0;

    logger.info('Webhook sync started', {
      integrationId: context.integrationId,
      webhookUrl: config.webhookUrl,
      events: config.events,
    });

    try {
      // Get pending data to send via webhook
      const pendingData = await this.getPendingData(context.organizationId, config);

      if (pendingData.length === 0) {
        logger.info('No pending data to send via webhook');
        return { recordsProcessed: 0 };
      }

      // Send webhooks for each batch of data
      for (const batch of pendingData) {
        const payload: WebhookPayload = {
          event: batch.event,
          timestamp: new Date().toISOString(),
          organizationId: context.organizationId,
          data: batch.data,
        };

        const success = await this.sendWebhook(config, payload);

        if (success) {
          recordsProcessed += batch.count;
          // Mark records as sent
          await this.markAsSent(batch.ids, batch.event);
        }
      }
    } catch (error) {
      logger.error('Webhook sync failed', {
        integrationId: context.integrationId,
        error: String(error),
      });
      throw error;
    }

    logger.info('Webhook sync completed', {
      integrationId: context.integrationId,
      recordsProcessed,
    });

    return { recordsProcessed };
  }

  private async sendWebhook(config: WebhookConfig, payload: WebhookPayload): Promise<boolean> {
    const payloadString = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    };

    // Add signature if secret is configured
    if (config.secret) {
      const signature = this.generateSignature(payloadString, config.secret);
      headers['X-Webhook-Signature'] = signature;
      headers['X-Webhook-Timestamp'] = payload.timestamp;
    }

    // Add custom auth header if configured
    if (config.authHeader && config.authValue) {
      headers[config.authHeader] = config.authValue;
    }

    try {
      const response = await axios.post(config.webhookUrl, payload, {
        headers,
        timeout: config.timeout ?? 30000,
        validateStatus: (status) => status >= 200 && status < 300,
      });

      logger.info('Webhook sent successfully', {
        url: config.webhookUrl,
        event: payload.event,
        status: response.status,
      });

      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Webhook request failed', {
          url: config.webhookUrl,
          event: payload.event,
          status: error.response?.status,
          message: error.message,
        });

        // Retry logic - let BullMQ handle retry for server errors
        if (config.retryOnFailure !== false && error.response?.status && error.response.status >= 500) {
          logger.info('Webhook will be retried by BullMQ');
          throw error;
        }
      }

      return false;
    }
  }

  private generateSignature(payload: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return `sha256=${hmac.digest('hex')}`;
  }

  private async getPendingData(
    organizationId: string,
    config: WebhookConfig
  ): Promise<Array<{ event: string; data: unknown; count: number; ids: string[] }>> {
    const result: Array<{ event: string; data: unknown; count: number; ids: string[] }> = [];
    const events = config.events ?? ['contributions.created'];

    for (const event of events) {
      switch (event) {
        case 'contributions.created':
        case 'contributions.updated': {
          const contributions = await prisma.contribution.findMany({
            where: {
              employee: { organizationId },
              status: 'VALIDATED',
              deletedAt: null,
            },
            take: config.batchSize ?? 100,
            include: {
              employee: {
                select: { employeeNumber: true },
              },
            },
          });

          if (contributions.length > 0) {
            result.push({
              event,
              data: contributions.map((c) => ({
                id: c.id,
                employeeNumber: c.employee.employeeNumber,
                payrollDate: c.payrollDate,
                employeePreTax: c.employeePreTax,
                employeeRoth: c.employeeRoth,
                employerMatch: c.employerMatch,
                employerNonMatch: c.employerNonMatch,
                loanRepayment: c.loanRepayment,
              })),
              count: contributions.length,
              ids: contributions.map((c) => c.id),
            });
          }
          break;
        }

        case 'elections.changed': {
          const elections = await prisma.deferralElection.findMany({
            where: {
              employee: { organizationId },
              status: 'PENDING',
              deletedAt: null,
            },
            take: config.batchSize ?? 100,
            include: {
              employee: {
                select: { employeeNumber: true },
              },
            },
          });

          if (elections.length > 0) {
            result.push({
              event,
              data: elections.map((e) => ({
                id: e.id,
                employeeNumber: e.employee.employeeNumber,
                preTaxPercent: e.preTaxPercent / 100,
                rothPercent: e.rothPercent / 100,
                catchUpPercent: e.catchUpPercent / 100,
                effectiveDate: e.effectiveDate,
              })),
              count: elections.length,
              ids: elections.map((e) => e.id),
            });
          }
          break;
        }

        default:
          logger.warn('Unknown webhook event type', { event });
      }
    }

    return result;
  }

  private async markAsSent(ids: string[], event: string): Promise<void> {
    if (event.startsWith('contributions.')) {
      // Update contribution status to SUBMITTED
      await prisma.contribution.updateMany({
        where: { id: { in: ids } },
        data: { status: 'SUBMITTED' },
      });
    } else if (event === 'elections.changed') {
      // Update election status to ACTIVE
      await prisma.deferralElection.updateMany({
        where: { id: { in: ids } },
        data: { status: 'ACTIVE' },
      });
    }
  }
}

export const webhookProcessor = new WebhookProcessor();
