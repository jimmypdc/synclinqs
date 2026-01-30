import { Queue, QueueOptions } from 'bullmq';
import { getRedisConnection } from './connection.js';
import { SyncJobData, SyncJobResult, IntegrationType, QueueName, QUEUE_CONFIGS, getQueueNameForType } from './types.js';
import { logger } from '../utils/logger.js';

const queues = new Map<QueueName, Queue<SyncJobData, SyncJobResult>>();

function createQueueOptions(): QueueOptions {
  return {
    connection: getRedisConnection(),
    defaultJobOptions: {
      removeOnComplete: {
        age: 24 * 60 * 60, // Keep completed jobs for 24 hours
        count: 1000, // Keep last 1000 completed jobs
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
        count: 5000, // Keep last 5000 failed jobs
      },
    },
  };
}

export function getQueue(queueName: QueueName): Queue<SyncJobData, SyncJobResult> {
  let queue = queues.get(queueName);

  if (!queue) {
    queue = new Queue<SyncJobData, SyncJobResult>(queueName, createQueueOptions());
    queues.set(queueName, queue);
    logger.info('Queue created', { queueName });
  }

  return queue;
}

export function getQueueForIntegrationType(type: IntegrationType): Queue<SyncJobData, SyncJobResult> {
  const queueName = getQueueNameForType(type);
  return getQueue(queueName);
}

export function getAllQueues(): Queue<SyncJobData, SyncJobResult>[] {
  // Ensure all queues are initialized
  for (const config of Object.values(QUEUE_CONFIGS)) {
    getQueue(config.name);
  }
  return Array.from(queues.values());
}

export async function addSyncJob(
  integrationType: IntegrationType,
  data: SyncJobData
): Promise<string> {
  const config = QUEUE_CONFIGS[integrationType];
  const queue = getQueueForIntegrationType(integrationType);

  const job = await queue.add(
    'sync',
    data,
    {
      jobId: data.idempotencyKey,
      attempts: config.maxRetries + 1, // Include initial attempt
      backoff: {
        type: 'exponential',
        delay: config.backoffBaseMs,
      },
    }
  );

  logger.info('Sync job added to queue', {
    jobId: job.id,
    queueName: config.name,
    integrationId: data.integrationId,
    integrationType: data.integrationType,
  });

  return job.id!;
}

export async function closeAllQueues(): Promise<void> {
  const closePromises = Array.from(queues.values()).map((queue) => queue.close());
  await Promise.all(closePromises);
  queues.clear();
  logger.info('All queues closed');
}
