import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

let redisConnection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis(config.redis.url, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        logger.warn('Redis connection retry', { attempt: times, delayMs: delay });
        return delay;
      },
    });

    redisConnection.on('connect', () => {
      logger.info('Redis connected for workers');
    });

    redisConnection.on('error', (error) => {
      logger.error('Redis connection error', { error: error.message });
    });

    redisConnection.on('close', () => {
      logger.warn('Redis connection closed');
    });
  }

  return redisConnection;
}

export async function closeRedisConnection(): Promise<void> {
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
    logger.info('Redis connection closed gracefully');
  }
}
