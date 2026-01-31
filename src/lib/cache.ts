import { getRedisClient } from './redis.js';
import { logger } from '../utils/logger.js';

/**
 * Cache TTL configuration in seconds
 */
export const CACHE_TTL = {
  FIELD_DEFINITIONS: 3600, // 1 hour - rarely changes
  MAPPING_TEMPLATES: 3600, // 1 hour - rarely changes
  TRANSFORMATION_FUNCTIONS: 3600, // 1 hour - system functions
  ORGANIZATION_SETTINGS: 300, // 5 minutes - may change
  VALIDATION_RULES: 1800, // 30 minutes
  DEFAULT: 600, // 10 minutes
} as const;

/**
 * Cache key prefixes for organization
 */
export const CACHE_PREFIX = {
  FIELDS: 'cache:fields',
  TEMPLATES: 'cache:templates',
  TRANSFORMATIONS: 'cache:transformations',
  ORGANIZATIONS: 'cache:orgs',
  VALIDATION: 'cache:validation',
} as const;

/**
 * Cache service for Redis-based caching with graceful degradation
 */
class CacheService {
  private enabled: boolean = true;

  /**
   * Enable or disable caching globally
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    logger.info('Cache service', { enabled });
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get a value from cache
   * Returns null if not found or on error
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) return null;

    try {
      const redis = getRedisClient();
      const value = await redis.get(key);

      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.warn('Cache get error', { key, error: (error as Error).message });
      return null;
    }
  }

  /**
   * Set a value in cache with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds: number = CACHE_TTL.DEFAULT): Promise<void> {
    if (!this.enabled) return;

    try {
      const redis = getRedisClient();
      const serialized = JSON.stringify(value);
      await redis.setex(key, ttlSeconds, serialized);
    } catch (error) {
      logger.warn('Cache set error', { key, error: (error as Error).message });
    }
  }

  /**
   * Delete a specific key from cache
   */
  async delete(key: string): Promise<void> {
    if (!this.enabled) return;

    try {
      const redis = getRedisClient();
      await redis.del(key);
    } catch (error) {
      logger.warn('Cache delete error', { key, error: (error as Error).message });
    }
  }

  /**
   * Delete all keys matching a pattern
   * Use with caution - SCAN is used to avoid blocking
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.enabled) return 0;

    try {
      const redis = getRedisClient();
      let cursor = '0';
      let totalDeleted = 0;

      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        if (keys.length > 0) {
          await redis.del(...keys);
          totalDeleted += keys.length;
        }
      } while (cursor !== '0');

      if (totalDeleted > 0) {
        logger.debug('Cache pattern deleted', { pattern, count: totalDeleted });
      }

      return totalDeleted;
    } catch (error) {
      logger.warn('Cache deletePattern error', { pattern, error: (error as Error).message });
      return 0;
    }
  }

  /**
   * Cache-aside pattern: get from cache or compute and store
   *
   * @param key - Cache key
   * @param fn - Function to compute value if not cached
   * @param ttlSeconds - TTL in seconds (default: 10 minutes)
   * @returns The cached or computed value
   */
  async wrap<T>(key: string, fn: () => Promise<T>, ttlSeconds: number = CACHE_TTL.DEFAULT): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Compute value
    const value = await fn();

    // Store in cache (don't await to not block response)
    this.set(key, value, ttlSeconds).catch(() => {
      // Error already logged in set()
    });

    return value;
  }

  /**
   * Get multiple values from cache
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.enabled || keys.length === 0) {
      return keys.map(() => null);
    }

    try {
      const redis = getRedisClient();
      const values = await redis.mget(...keys);

      return values.map((value) => {
        if (value === null) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      logger.warn('Cache mget error', { keyCount: keys.length, error: (error as Error).message });
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values in cache
   */
  async mset<T>(entries: Array<{ key: string; value: T; ttlSeconds?: number }>): Promise<void> {
    if (!this.enabled || entries.length === 0) return;

    try {
      const redis = getRedisClient();
      const pipeline = redis.pipeline();

      for (const { key, value, ttlSeconds = CACHE_TTL.DEFAULT } of entries) {
        const serialized = JSON.stringify(value);
        pipeline.setex(key, ttlSeconds, serialized);
      }

      await pipeline.exec();
    } catch (error) {
      logger.warn('Cache mset error', { entryCount: entries.length, error: (error as Error).message });
    }
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const redis = getRedisClient();
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.warn('Cache exists error', { key, error: (error as Error).message });
      return false;
    }
  }

  /**
   * Get TTL for a key in seconds
   * Returns -2 if key doesn't exist, -1 if no TTL
   */
  async ttl(key: string): Promise<number> {
    if (!this.enabled) return -2;

    try {
      const redis = getRedisClient();
      return await redis.ttl(key);
    } catch (error) {
      logger.warn('Cache ttl error', { key, error: (error as Error).message });
      return -2;
    }
  }

  /**
   * Increment a counter in cache
   */
  async increment(key: string, ttlSeconds?: number): Promise<number> {
    if (!this.enabled) return 0;

    try {
      const redis = getRedisClient();
      const value = await redis.incr(key);

      // Set TTL on first increment
      if (ttlSeconds && value === 1) {
        await redis.expire(key, ttlSeconds);
      }

      return value;
    } catch (error) {
      logger.warn('Cache increment error', { key, error: (error as Error).message });
      return 0;
    }
  }

  /**
   * Build a cache key with prefix and segments
   */
  buildKey(prefix: string, ...segments: (string | number)[]): string {
    return [prefix, ...segments].join(':');
  }
}

// Export singleton instance
export const cache = new CacheService();

// Export helper function to build cache keys
export function cacheKey(prefix: string, ...segments: (string | number)[]): string {
  return cache.buildKey(prefix, ...segments);
}
