import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

let redisClient: Redis | null = null;

/**
 * Get the shared Redis client instance
 *
 * Creates a singleton Redis connection for the API server.
 * For BullMQ workers, use the workers/connection.ts module instead.
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy(times) {
        if (times > 10) {
          logger.error('Redis connection failed after 10 retries');
          return null; // Stop retrying
        }
        const delay = Math.min(times * 100, 3000);
        logger.warn('Redis connection retry', { attempt: times, delayMs: delay });
        return delay;
      },
      reconnectOnError(err) {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          // Reconnect on READONLY error (failover scenario)
          return true;
        }
        return false;
      },
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected for API');
    });

    redisClient.on('ready', () => {
      logger.info('Redis ready for API');
    });

    redisClient.on('error', (error) => {
      logger.error('Redis connection error', { error: error.message });
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis reconnecting');
    });
  }

  return redisClient;
}

/**
 * Export the redis client as a convenient alias
 */
export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    const client = getRedisClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

/**
 * Close the Redis connection gracefully
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis API connection closed gracefully');
  }
}

/**
 * Health check for Redis connection
 */
export async function isRedisHealthy(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}
