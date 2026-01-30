import { Request, Response, NextFunction } from 'express';
import { redis } from '../../lib/redis.js';
import { logger } from '../../utils/logger.js';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

// Default rate limits per billing plan (requests per minute)
const PLAN_RATE_LIMITS: Record<string, RateLimitConfig> = {
  trial: { windowMs: 60 * 1000, maxRequests: 20 },
  starter: { windowMs: 60 * 1000, maxRequests: 100 },
  professional: { windowMs: 60 * 1000, maxRequests: 500 },
  enterprise: { windowMs: 60 * 1000, maxRequests: 2000 },
};

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 20,
};

/**
 * Organization Rate Limiter Middleware
 *
 * Applies per-organization rate limiting based on billing plan.
 * Uses Redis sliding window algorithm for accurate rate limiting.
 *
 * Rate limits:
 * - Trial: 20 requests/minute
 * - Starter: 100 requests/minute
 * - Professional: 500 requests/minute
 * - Enterprise: 2000 requests/minute
 */
export async function organizationRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const organizationId = req.organizationId;

  // Skip if no organization context
  if (!organizationId) {
    return next();
  }

  try {
    // Get rate limit based on billing plan
    const billingPlan = req.organization?.billingPlan ?? 'trial';
    const config = PLAN_RATE_LIMITS[billingPlan] ?? DEFAULT_RATE_LIMIT;

    // Check if organization has custom API limit
    const maxApiCallsPerMonth = req.organization?.maxApiCallsPerMonth;
    if (maxApiCallsPerMonth) {
      // Convert monthly limit to per-minute limit (rough approximation)
      // 30 days * 24 hours * 60 minutes = 43,200 minutes per month
      const customMaxPerMinute = Math.max(1, Math.floor(maxApiCallsPerMonth / 43200));
      config.maxRequests = Math.min(config.maxRequests, customMaxPerMinute * 10); // Allow burst
    }

    const key = `rate:org:${organizationId}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Use Redis sorted set for sliding window
    const multi = redis.multi();

    // Remove old entries outside the window
    multi.zremrangebyscore(key, 0, windowStart);

    // Count current requests in window
    multi.zcard(key);

    // Add current request timestamp
    multi.zadd(key, now, `${now}-${Math.random()}`);

    // Set expiry on the key
    multi.expire(key, Math.ceil(config.windowMs / 1000) + 1);

    const results = await multi.exec();

    if (!results) {
      // Redis transaction failed, allow the request but log warning
      logger.warn('Rate limit check failed, allowing request', { organizationId });
      return next();
    }

    // Get the count from results (second command in multi)
    const requestCount = results[1]?.[1] as number ?? 0;

    // Calculate remaining requests
    const remaining = Math.max(0, config.maxRequests - requestCount - 1);
    const resetTime = new Date(now + config.windowMs);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTime.toISOString());

    // Check if limit exceeded
    if (requestCount >= config.maxRequests) {
      logger.warn('Rate limit exceeded', {
        organizationId,
        billingPlan,
        requestCount,
        maxRequests: config.maxRequests,
      });

      // Remove the request we just added since it's being rejected
      await redis.zrem(key, `${now}-${Math.random()}`);

      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil(config.windowMs / 1000),
        },
      });
      return;
    }

    next();
  } catch (error) {
    // On Redis errors, allow the request but log the error
    logger.error('Organization rate limiter error', {
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    next();
  }
}

/**
 * Track API Usage Middleware
 *
 * Tracks total API calls per organization for billing/analytics.
 * Should be applied after authentication.
 */
export async function trackApiUsage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const organizationId = req.organizationId;

  if (!organizationId) {
    return next();
  }

  try {
    // Track daily usage
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = `api:usage:${organizationId}:${today}`;

    await redis.incr(dailyKey);
    await redis.expire(dailyKey, 7 * 24 * 60 * 60); // Keep for 7 days

    // Track monthly usage
    const month = new Date().toISOString().slice(0, 7);
    const monthlyKey = `api:usage:${organizationId}:${month}`;

    await redis.incr(monthlyKey);
    await redis.expire(monthlyKey, 35 * 24 * 60 * 60); // Keep for 35 days

    next();
  } catch (error) {
    // Non-critical, just log and continue
    logger.error('Failed to track API usage', {
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    next();
  }
}

/**
 * Get API Usage Stats
 */
export async function getApiUsageStats(organizationId: string): Promise<{
  daily: number;
  monthly: number;
}> {
  const today = new Date().toISOString().split('T')[0];
  const month = new Date().toISOString().slice(0, 7);

  const [daily, monthly] = await Promise.all([
    redis.get(`api:usage:${organizationId}:${today}`),
    redis.get(`api:usage:${organizationId}:${month}`),
  ]);

  return {
    daily: parseInt(daily ?? '0', 10),
    monthly: parseInt(monthly ?? '0', 10),
  };
}
