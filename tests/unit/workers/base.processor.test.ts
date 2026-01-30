import { Job } from 'bullmq';
import { processJob, TypeProcessor, ProcessorContext } from '../../../src/workers/processors/base.processor';
import { SyncJobData, SyncJobResult } from '../../../src/workers/types';
import { prisma } from '../../../src/lib/prisma';
import { decrypt } from '../../../src/utils/encryption';
import { AuditService } from '../../../src/services/audit.service';

// Mock dependencies
jest.mock('../../../src/lib/prisma', () => ({
  prisma: {
    integration: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../../src/services/email.service', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendSyncNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../src/utils/encryption', () => ({
  decrypt: jest.fn(),
}));

jest.mock('../../../src/services/audit.service', () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    log: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Base Processor', () => {
  const mockIntegration = {
    id: 'integration-123',
    organizationId: 'org-456',
    name: 'Test Integration',
    type: 'REST_API',
    status: 'ACTIVE',
    configEncrypted: 'encrypted-config',
    lastSyncAt: null,
    lastSyncStatus: null,
    deletedAt: null,
  };

  const mockJobData: SyncJobData = {
    integrationId: 'integration-123',
    organizationId: 'org-456',
    integrationType: 'REST_API',
    triggeredBy: 'user-789',
    triggeredAt: '2024-01-29T10:00:00Z',
    idempotencyKey: 'sync:integration-123:abc',
  };

  const mockJob = {
    id: 'job-001',
    data: mockJobData,
    attemptsMade: 0,
    opts: { attempts: 5 },
  } as unknown as Job<SyncJobData, SyncJobResult>;

  const mockProcessor: TypeProcessor = {
    processSync: jest.fn().mockResolvedValue({ recordsProcessed: 10 }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration);
    (prisma.integration.findUnique as jest.Mock).mockResolvedValue({ name: 'Test Integration' });
    (prisma.integration.update as jest.Mock).mockResolvedValue(mockIntegration);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ email: 'test@example.com' });
    (decrypt as jest.Mock).mockReturnValue('{"apiKey": "test"}');
  });

  describe('processJob', () => {
    it('should successfully process a sync job', async () => {
      const result = await processJob(mockJob, mockProcessor);

      expect(result.success).toBe(true);
      expect(result.integrationId).toBe('integration-123');
      expect(result.recordsProcessed).toBe(10);
      expect(result.completedAt).toBeDefined();
    });

    it('should fetch integration from database', async () => {
      await processJob(mockJob, mockProcessor);

      expect(prisma.integration.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'integration-123',
          organizationId: 'org-456',
          deletedAt: null,
        },
      });
    });

    it('should decrypt integration config', async () => {
      await processJob(mockJob, mockProcessor);

      expect(decrypt).toHaveBeenCalledWith('encrypted-config');
    });

    it('should update status to PROCESSING before sync', async () => {
      await processJob(mockJob, mockProcessor);

      expect(prisma.integration.update).toHaveBeenCalledWith({
        where: { id: 'integration-123' },
        data: { lastSyncStatus: 'PROCESSING' },
      });
    });

    it('should update status to SUCCESS after sync', async () => {
      await processJob(mockJob, mockProcessor);

      expect(prisma.integration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'integration-123' },
          data: expect.objectContaining({
            lastSyncStatus: 'SUCCESS',
          }),
        })
      );
    });

    it('should call type-specific processor', async () => {
      await processJob(mockJob, mockProcessor);

      expect(mockProcessor.processSync).toHaveBeenCalledWith({
        integrationId: 'integration-123',
        organizationId: 'org-456',
        integrationType: 'REST_API',
        config: { apiKey: 'test' },
        triggeredBy: 'user-789',
      });
    });

    it('should throw error if integration not found', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(processJob(mockJob, mockProcessor)).rejects.toThrow(
        'Integration not found: integration-123'
      );
    });

    it('should throw error if integration is not active', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue({
        ...mockIntegration,
        status: 'INACTIVE',
      });

      await expect(processJob(mockJob, mockProcessor)).rejects.toThrow(
        'Integration is not active: INACTIVE'
      );
    });

    it('should update status to FAILED on error', async () => {
      (mockProcessor.processSync as jest.Mock).mockRejectedValue(new Error('Sync failed'));

      await expect(processJob(mockJob, mockProcessor)).rejects.toThrow('Sync failed');

      expect(prisma.integration.update).toHaveBeenCalledWith({
        where: { id: 'integration-123' },
        data: { lastSyncStatus: 'FAILED' },
      });
    });

    it('should re-throw error for BullMQ retry', async () => {
      const error = new Error('Connection timeout');
      (mockProcessor.processSync as jest.Mock).mockRejectedValue(error);

      await expect(processJob(mockJob, mockProcessor)).rejects.toThrow('Connection timeout');
    });
  });
});
