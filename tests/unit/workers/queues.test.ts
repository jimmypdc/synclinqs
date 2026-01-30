import { SyncJobData, QUEUE_CONFIGS } from '../../../src/workers/types';

// Create mock instances
const mockQueueAdd = jest.fn();
const mockQueueClose = jest.fn();

// Mock BullMQ Queue before importing the module
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    close: mockQueueClose,
  })),
}));

// Mock Redis connection
jest.mock('../../../src/workers/connection', () => ({
  getRedisConnection: jest.fn(() => ({})),
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

// Import after mocks are set up
import { Queue } from 'bullmq';
import {
  getQueue,
  getQueueForIntegrationType,
  getAllQueues,
  addSyncJob,
  closeAllQueues,
} from '../../../src/workers/queues';

describe('Queues', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getQueue', () => {
    it('should create a queue with the specified name', () => {
      const queue = getQueue('sync-sftp');

      expect(queue).toBeDefined();
      expect(Queue).toHaveBeenCalled();
    });

    it('should return same queue instance on subsequent calls', () => {
      // Clear any previous calls
      (Queue as unknown as jest.Mock).mockClear();

      const queue1 = getQueue('sync-soap');
      const initialCallCount = (Queue as unknown as jest.Mock).mock.calls.length;

      const queue2 = getQueue('sync-soap');
      const finalCallCount = (Queue as unknown as jest.Mock).mock.calls.length;

      expect(queue1).toBe(queue2);
      // Should not create new queue on second call
      expect(finalCallCount).toBe(initialCallCount);
    });
  });

  describe('getQueueForIntegrationType', () => {
    it('should return queue for SFTP type', () => {
      const queue = getQueueForIntegrationType('SFTP');
      expect(queue).toBeDefined();
    });

    it('should return queue for REST_API type', () => {
      const queue = getQueueForIntegrationType('REST_API');
      expect(queue).toBeDefined();
    });

    it('should return queue for SOAP type', () => {
      const queue = getQueueForIntegrationType('SOAP');
      expect(queue).toBeDefined();
    });

    it('should return queue for WEBHOOK type', () => {
      const queue = getQueueForIntegrationType('WEBHOOK');
      expect(queue).toBeDefined();
    });
  });

  describe('getAllQueues', () => {
    it('should return array of queues', () => {
      const queues = getAllQueues();

      expect(Array.isArray(queues)).toBe(true);
      expect(queues.length).toBeGreaterThan(0);
    });

    it('should return queues for all integration types', () => {
      const queues = getAllQueues();

      // Should have 4 queues (one for each integration type)
      expect(queues.length).toBe(4);
    });
  });

  describe('addSyncJob', () => {
    it('should add job to queue with correct data', async () => {
      mockQueueAdd.mockResolvedValue({ id: 'job-123' });

      const jobData: SyncJobData = {
        integrationId: 'int-1',
        organizationId: 'org-1',
        integrationType: 'REST_API',
        triggeredBy: 'user-1',
        triggeredAt: '2024-01-29T10:00:00Z',
        idempotencyKey: 'sync:int-1:abc123',
      };

      const jobId = await addSyncJob('REST_API', jobData);

      expect(jobId).toBe('job-123');
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'sync',
        jobData,
        expect.objectContaining({
          jobId: 'sync:int-1:abc123',
        })
      );
    });

    it('should configure exponential backoff', async () => {
      mockQueueAdd.mockResolvedValue({ id: 'job-456' });

      const jobData: SyncJobData = {
        integrationId: 'int-1',
        organizationId: 'org-1',
        integrationType: 'SFTP',
        triggeredBy: 'user-1',
        triggeredAt: '2024-01-29T10:00:00Z',
        idempotencyKey: 'sync:int-1:xyz',
      };

      await addSyncJob('SFTP', jobData);

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'sync',
        expect.any(Object),
        expect.objectContaining({
          backoff: {
            type: 'exponential',
            delay: QUEUE_CONFIGS.SFTP.backoffBaseMs,
          },
        })
      );
    });

    it('should set correct retry attempts based on config', async () => {
      mockQueueAdd.mockResolvedValue({ id: 'job-789' });

      const jobData: SyncJobData = {
        integrationId: 'int-1',
        organizationId: 'org-1',
        integrationType: 'WEBHOOK',
        triggeredBy: 'user-1',
        triggeredAt: '2024-01-29T10:00:00Z',
        idempotencyKey: 'sync:int-1:webhook',
      };

      await addSyncJob('WEBHOOK', jobData);

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'sync',
        expect.any(Object),
        expect.objectContaining({
          attempts: QUEUE_CONFIGS.WEBHOOK.maxRetries + 1,
        })
      );
    });

    it('should use idempotencyKey as jobId', async () => {
      mockQueueAdd.mockResolvedValue({ id: 'job-abc' });

      const idempotencyKey = 'unique-sync-key-12345';
      const jobData: SyncJobData = {
        integrationId: 'int-1',
        organizationId: 'org-1',
        integrationType: 'SOAP',
        triggeredBy: 'user-1',
        triggeredAt: '2024-01-29T10:00:00Z',
        idempotencyKey,
      };

      await addSyncJob('SOAP', jobData);

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'sync',
        expect.any(Object),
        expect.objectContaining({
          jobId: idempotencyKey,
        })
      );
    });
  });

  describe('closeAllQueues', () => {
    it('should close all queues without error', async () => {
      mockQueueClose.mockResolvedValue(undefined);

      // Initialize some queues first
      getAllQueues();

      await expect(closeAllQueues()).resolves.not.toThrow();
    });
  });
});
