import axios from 'axios';
import crypto from 'crypto';
import { WebhookProcessor } from '../../../src/workers/processors/webhook.processor';
import { ProcessorContext } from '../../../src/workers/processors/base.processor';
import { WebhookConfig } from '../../../src/workers/types';
import { prisma } from '../../../src/lib/prisma';

// Mock axios
jest.mock('axios', () => ({
  post: jest.fn(),
  isAxiosError: jest.fn((error) => error.isAxiosError === true),
}));

// Mock prisma
jest.mock('../../../src/lib/prisma', () => ({
  prisma: {
    contribution: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    deferralElection: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('WebhookProcessor', () => {
  let processor: WebhookProcessor;

  const baseContext: Omit<ProcessorContext, 'config'> = {
    integrationId: 'int-123',
    organizationId: 'org-456',
    integrationType: 'WEBHOOK',
    triggeredBy: 'user-789',
  };

  const mockContributions = [
    {
      id: 'contrib-1',
      payrollDate: new Date('2024-01-15'),
      employeePreTax: 50000,
      employeeRoth: 0,
      employerMatch: 25000,
      employerNonMatch: 0,
      loanRepayment: 0,
      employee: { employeeNumber: 'EMP001' },
    },
    {
      id: 'contrib-2',
      payrollDate: new Date('2024-01-15'),
      employeePreTax: 75000,
      employeeRoth: 25000,
      employerMatch: 37500,
      employerNonMatch: 0,
      loanRepayment: 0,
      employee: { employeeNumber: 'EMP002' },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new WebhookProcessor();
    (prisma.contribution.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.deferralElection.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.contribution.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.deferralElection.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
  });

  describe('processSync', () => {
    it('should return 0 records when no pending data', async () => {
      const config: WebhookConfig = {
        webhookUrl: 'https://example.com/webhook',
        events: ['contributions.created'],
      };

      const result = await processor.processSync({ ...baseContext, config });

      expect(result.recordsProcessed).toBe(0);
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('should send webhook for pending contributions', async () => {
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue(mockContributions);
      (axios.post as jest.Mock).mockResolvedValue({ status: 200 });

      const config: WebhookConfig = {
        webhookUrl: 'https://example.com/webhook',
        events: ['contributions.created'],
      };

      const result = await processor.processSync({ ...baseContext, config });

      expect(result.recordsProcessed).toBe(2);
      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          event: 'contributions.created',
          organizationId: 'org-456',
          data: expect.any(Array),
        }),
        expect.any(Object)
      );
    });

    it('should update contribution status after successful send', async () => {
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue(mockContributions);
      (axios.post as jest.Mock).mockResolvedValue({ status: 200 });

      const config: WebhookConfig = {
        webhookUrl: 'https://example.com/webhook',
        events: ['contributions.created'],
      };

      await processor.processSync({ ...baseContext, config });

      expect(prisma.contribution.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['contrib-1', 'contrib-2'] } },
        data: { status: 'SUBMITTED' },
      });
    });

    it('should include signature when secret is configured', async () => {
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue(mockContributions);
      (axios.post as jest.Mock).mockResolvedValue({ status: 200 });

      const config: WebhookConfig = {
        webhookUrl: 'https://example.com/webhook',
        secret: 'my-secret-key',
        events: ['contributions.created'],
      };

      await processor.processSync({ ...baseContext, config });

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Webhook-Signature': expect.stringMatching(/^sha256=/),
            'X-Webhook-Timestamp': expect.any(String),
          }),
        })
      );
    });

    it('should include custom auth header when configured', async () => {
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue(mockContributions);
      (axios.post as jest.Mock).mockResolvedValue({ status: 200 });

      const config: WebhookConfig = {
        webhookUrl: 'https://example.com/webhook',
        authHeader: 'X-API-Key',
        authValue: 'secret-api-key',
        events: ['contributions.created'],
      };

      await processor.processSync({ ...baseContext, config });

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'secret-api-key',
          }),
        })
      );
    });

    it('should handle webhook failure without throwing', async () => {
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue(mockContributions);
      const axiosError = { isAxiosError: true, response: { status: 400 }, message: 'Bad request' };
      (axios.post as jest.Mock).mockRejectedValue(axiosError);
      (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);

      const config: WebhookConfig = {
        webhookUrl: 'https://example.com/webhook',
        events: ['contributions.created'],
      };

      const result = await processor.processSync({ ...baseContext, config });

      expect(result.recordsProcessed).toBe(0);
      expect(prisma.contribution.updateMany).not.toHaveBeenCalled();
    });

    it('should throw for server errors to trigger retry', async () => {
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue(mockContributions);
      const axiosError = { isAxiosError: true, response: { status: 500 }, message: 'Server error' };
      (axios.post as jest.Mock).mockRejectedValue(axiosError);
      (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);

      const config: WebhookConfig = {
        webhookUrl: 'https://example.com/webhook',
        events: ['contributions.created'],
        retryOnFailure: true,
      };

      await expect(processor.processSync({ ...baseContext, config })).rejects.toEqual(axiosError);
    });

    it('should handle elections.changed event', async () => {
      const mockElections = [
        {
          id: 'election-1',
          preTaxPercent: 500, // 5.00%
          rothPercent: 200, // 2.00%
          catchUpPercent: 0,
          effectiveDate: new Date('2024-02-01'),
          employee: { employeeNumber: 'EMP001' },
        },
      ];

      (prisma.deferralElection.findMany as jest.Mock).mockResolvedValue(mockElections);
      (axios.post as jest.Mock).mockResolvedValue({ status: 200 });

      const config: WebhookConfig = {
        webhookUrl: 'https://example.com/webhook',
        events: ['elections.changed'],
      };

      const result = await processor.processSync({ ...baseContext, config });

      expect(result.recordsProcessed).toBe(1);
      expect(prisma.deferralElection.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['election-1'] } },
        data: { status: 'ACTIVE' },
      });
    });

    it('should use custom timeout when configured', async () => {
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue(mockContributions);
      (axios.post as jest.Mock).mockResolvedValue({ status: 200 });

      const config: WebhookConfig = {
        webhookUrl: 'https://example.com/webhook',
        timeout: 5000,
        events: ['contributions.created'],
      };

      await processor.processSync({ ...baseContext, config });

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          timeout: 5000,
        })
      );
    });

    it('should respect batchSize configuration', async () => {
      const config: WebhookConfig = {
        webhookUrl: 'https://example.com/webhook',
        batchSize: 50,
        events: ['contributions.created'],
      };

      await processor.processSync({ ...baseContext, config });

      expect(prisma.contribution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });
  });

  describe('signature generation', () => {
    it('should generate valid HMAC-SHA256 signature', async () => {
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue(mockContributions);
      (axios.post as jest.Mock).mockResolvedValue({ status: 200 });

      const secret = 'test-secret';
      const config: WebhookConfig = {
        webhookUrl: 'https://example.com/webhook',
        secret,
        events: ['contributions.created'],
      };

      await processor.processSync({ ...baseContext, config });

      const call = (axios.post as jest.Mock).mock.calls[0];
      const payload = call[1];
      const headers = call[2].headers;

      // Verify signature format
      expect(headers['X-Webhook-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/);

      // Verify signature is correct
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      expect(headers['X-Webhook-Signature']).toBe(`sha256=${expectedSignature}`);
    });
  });
});
