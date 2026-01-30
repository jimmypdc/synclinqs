import { Queue, Job } from 'bullmq';
import IORedis from 'ioredis';
import { SyncJobData, IntegrationType, QUEUE_CONFIGS } from '../../../src/workers/types';

/**
 * Integration tests for BullMQ queues
 *
 * These tests require a running Redis instance.
 * Skip these tests in CI if Redis is not available.
 *
 * Run with: npm test -- tests/integration/workers/queues.integration.test.ts
 */

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const TEST_TIMEOUT = 30000;

describe('Queue Integration Tests', () => {
  let connection: IORedis;
  let testQueues: Map<string, Queue<SyncJobData>>;
  let isRedisAvailable = false;

  beforeAll(async () => {
    // Check if Redis is available
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    try {
      await connection.connect();
      const pong = await connection.ping();
      isRedisAvailable = pong === 'PONG';
    } catch {
      console.warn('Redis not available, skipping integration tests');
      isRedisAvailable = false;
    }

    if (isRedisAvailable) {
      // Create test queues with test prefix to avoid conflicts with production queues
      testQueues = new Map();
      for (const [type, config] of Object.entries(QUEUE_CONFIGS)) {
        const testQueueName = `test-${config.name}`;
        const queue = new Queue<SyncJobData>(testQueueName, {
          connection,
        });
        testQueues.set(type, queue);
      }
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (testQueues) {
      // Clean up test queues
      for (const queue of testQueues.values()) {
        await queue.obliterate({ force: true });
        await queue.close();
      }
    }

    if (connection) {
      await connection.quit();
    }
  });

  const skipIfNoRedis = () => {
    if (!isRedisAvailable) {
      return true;
    }
    return false;
  };

  describe('Queue creation', () => {
    it('should create queues for all integration types', () => {
      if (skipIfNoRedis()) {
        console.log('Skipping: Redis not available');
        return;
      }

      expect(testQueues.size).toBe(4);
      expect(testQueues.has('SFTP')).toBe(true);
      expect(testQueues.has('REST_API')).toBe(true);
      expect(testQueues.has('SOAP')).toBe(true);
      expect(testQueues.has('WEBHOOK')).toBe(true);
    });
  });

  describe('Job enqueueing', () => {
    it(
      'should add a job to the SFTP queue',
      async () => {
        if (skipIfNoRedis()) {
          console.log('Skipping: Redis not available');
          return;
        }

        const queue = testQueues.get('SFTP')!;
        const jobData: SyncJobData = {
          integrationId: 'test-integration-id',
          organizationId: 'test-org-id',
          integrationType: 'SFTP' as IntegrationType,
          triggeredBy: 'test-user-id',
          triggeredAt: new Date().toISOString(),
          idempotencyKey: `test-${Date.now()}`,
        };

        const job = await queue.add('sync', jobData);

        expect(job).toBeDefined();
        expect(job.id).toBeDefined();
        expect(job.data).toEqual(jobData);

        // Clean up
        await job.remove();
      },
      TEST_TIMEOUT
    );

    it(
      'should add a job to the REST_API queue with retry options',
      async () => {
        if (skipIfNoRedis()) {
          console.log('Skipping: Redis not available');
          return;
        }

        const queue = testQueues.get('REST_API')!;
        const config = QUEUE_CONFIGS.REST_API;
        const jobData: SyncJobData = {
          integrationId: 'test-integration-id',
          organizationId: 'test-org-id',
          integrationType: 'REST_API' as IntegrationType,
          triggeredBy: 'test-user-id',
          triggeredAt: new Date().toISOString(),
          idempotencyKey: `test-${Date.now()}`,
        };

        const job = await queue.add('sync', jobData, {
          attempts: config.maxRetries,
          backoff: {
            type: 'exponential',
            delay: config.backoffBaseMs,
          },
        });

        expect(job).toBeDefined();
        expect(job.opts.attempts).toBe(config.maxRetries);
        expect(job.opts.backoff).toEqual({
          type: 'exponential',
          delay: config.backoffBaseMs,
        });

        // Clean up
        await job.remove();
      },
      TEST_TIMEOUT
    );

    it(
      'should preserve job data through queue',
      async () => {
        if (skipIfNoRedis()) {
          console.log('Skipping: Redis not available');
          return;
        }

        const queue = testQueues.get('WEBHOOK')!;
        const jobData: SyncJobData = {
          integrationId: 'webhook-test-id',
          organizationId: 'org-123',
          integrationType: 'WEBHOOK' as IntegrationType,
          triggeredBy: 'user-456',
          triggeredAt: '2024-01-15T10:00:00Z',
          idempotencyKey: 'unique-key-789',
        };

        const addedJob = await queue.add('sync', jobData);
        const retrievedJob = await queue.getJob(addedJob.id!);

        expect(retrievedJob).toBeDefined();
        expect(retrievedJob?.data.integrationId).toBe(jobData.integrationId);
        expect(retrievedJob?.data.organizationId).toBe(jobData.organizationId);
        expect(retrievedJob?.data.integrationType).toBe(jobData.integrationType);
        expect(retrievedJob?.data.triggeredBy).toBe(jobData.triggeredBy);
        expect(retrievedJob?.data.triggeredAt).toBe(jobData.triggeredAt);
        expect(retrievedJob?.data.idempotencyKey).toBe(jobData.idempotencyKey);

        // Clean up
        await addedJob.remove();
      },
      TEST_TIMEOUT
    );
  });

  describe('Queue operations', () => {
    it(
      'should return waiting jobs count',
      async () => {
        if (skipIfNoRedis()) {
          console.log('Skipping: Redis not available');
          return;
        }

        const queue = testQueues.get('SOAP')!;
        const initialCount = await queue.getWaitingCount();

        const jobData: SyncJobData = {
          integrationId: 'test-id',
          organizationId: 'test-org',
          integrationType: 'SOAP' as IntegrationType,
          triggeredBy: 'test-user',
          triggeredAt: new Date().toISOString(),
          idempotencyKey: `test-${Date.now()}`,
        };

        const job1 = await queue.add('sync', jobData);
        const job2 = await queue.add('sync', { ...jobData, idempotencyKey: `test-${Date.now()}-2` });

        const newCount = await queue.getWaitingCount();
        expect(newCount).toBe(initialCount + 2);

        // Clean up
        await job1.remove();
        await job2.remove();
      },
      TEST_TIMEOUT
    );

    it(
      'should remove a job from the queue',
      async () => {
        if (skipIfNoRedis()) {
          console.log('Skipping: Redis not available');
          return;
        }

        const queue = testQueues.get('SFTP')!;
        const jobData: SyncJobData = {
          integrationId: 'remove-test',
          organizationId: 'test-org',
          integrationType: 'SFTP' as IntegrationType,
          triggeredBy: 'test-user',
          triggeredAt: new Date().toISOString(),
          idempotencyKey: `test-${Date.now()}`,
        };

        const job = await queue.add('sync', jobData);
        const jobId = job.id;

        await job.remove();

        const removedJob = await queue.getJob(jobId!);
        expect(removedJob).toBeUndefined();
      },
      TEST_TIMEOUT
    );
  });

  describe('Queue configuration', () => {
    it('should have correct configuration for each queue type', () => {
      // Verify QUEUE_CONFIGS match the implementation
      expect(QUEUE_CONFIGS.SFTP).toEqual({
        name: 'sync-sftp',
        concurrency: 2,
        timeoutMs: 30 * 60 * 1000, // 30 minutes
        maxRetries: 3,
        backoffBaseMs: 60 * 1000, // 60 seconds
      });

      expect(QUEUE_CONFIGS.REST_API).toEqual({
        name: 'sync-rest-api',
        concurrency: 10,
        timeoutMs: 5 * 60 * 1000, // 5 minutes
        maxRetries: 5,
        backoffBaseMs: 5 * 1000, // 5 seconds
      });

      expect(QUEUE_CONFIGS.SOAP).toEqual({
        name: 'sync-soap',
        concurrency: 3,
        timeoutMs: 10 * 60 * 1000, // 10 minutes
        maxRetries: 4,
        backoffBaseMs: 30 * 1000, // 30 seconds
      });

      expect(QUEUE_CONFIGS.WEBHOOK).toEqual({
        name: 'sync-webhook',
        concurrency: 5,
        timeoutMs: 1 * 60 * 1000, // 1 minute
        maxRetries: 2,
        backoffBaseMs: 10 * 1000, // 10 seconds
      });
    });
  });
});
