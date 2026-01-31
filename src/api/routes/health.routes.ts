import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { isRedisHealthy, getRedisClient } from '../../lib/redis.js';
import { getAllQueues } from '../../workers/queues.js';
import { logger } from '../../utils/logger.js';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
}

interface ReadinessStatus extends HealthStatus {
  checks: {
    database: ComponentHealth;
    redis: ComponentHealth;
    queues: QueueHealth;
  };
}

interface ComponentHealth {
  status: 'healthy' | 'unhealthy';
  latencyMs?: number;
  error?: string;
}

interface QueueHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  queues: Record<
    string,
    {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    }
  >;
}

const startTime = Date.now();
const version = process.env.npm_package_version || '1.0.0';

/**
 * GET /health
 * Basic liveness check - fast, no dependencies
 * Used by load balancers for basic health verification
 */
router.get('/', (_req: Request, res: Response) => {
  const response: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  res.json(response);
});

/**
 * GET /health/ready
 * Readiness check - verifies all dependencies are healthy
 * Used by Kubernetes/ECS for readiness probes
 */
router.get('/ready', async (_req: Request, res: Response) => {
  const checks = await runHealthChecks();

  const allHealthy =
    checks.database.status === 'healthy' &&
    checks.redis.status === 'healthy' &&
    checks.queues.status !== 'unhealthy';

  const response: ReadinessStatus = {
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };

  res.status(allHealthy ? 200 : 503).json(response);
});

/**
 * GET /health/detailed
 * Detailed health status with metrics
 * Should be protected in production (admin only)
 */
router.get('/detailed', async (_req: Request, res: Response) => {
  const checks = await runHealthChecks();

  const overallStatus = determineOverallStatus(checks);

  const response: ReadinessStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };

  res.json(response);
});

/**
 * Run all health checks
 */
async function runHealthChecks(): Promise<ReadinessStatus['checks']> {
  const [database, redis, queues] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkQueues(),
  ]);

  return { database, redis, queues };
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<ComponentHealth> {
  const start = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'healthy',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    logger.error('Database health check failed', { error: (error as Error).message });
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Check Redis connectivity
 */
async function checkRedis(): Promise<ComponentHealth> {
  const start = Date.now();

  try {
    const healthy = await isRedisHealthy();

    if (!healthy) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: 'Redis ping failed',
      };
    }

    return {
      status: 'healthy',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    logger.error('Redis health check failed', { error: (error as Error).message });
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Check queue health
 */
async function checkQueues(): Promise<QueueHealth> {
  try {
    const queues = getAllQueues();
    const queueStats: QueueHealth['queues'] = {};

    let totalFailed = 0;
    let totalActive = 0;

    for (const queue of queues) {
      try {
        const counts = await queue.getJobCounts();
        queueStats[queue.name] = {
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          completed: counts.completed || 0,
          failed: counts.failed || 0,
        };
        totalFailed += counts.failed || 0;
        totalActive += counts.active || 0;
      } catch {
        queueStats[queue.name] = {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: -1, // Indicate error
        };
      }
    }

    // Determine queue health status
    let status: QueueHealth['status'] = 'healthy';
    if (totalFailed > 100) {
      status = 'degraded';
    }
    if (totalFailed > 1000) {
      status = 'unhealthy';
    }

    return { status, queues: queueStats };
  } catch (error) {
    logger.error('Queue health check failed', { error: (error as Error).message });
    return {
      status: 'unhealthy',
      queues: {},
    };
  }
}

/**
 * Determine overall health status
 */
function determineOverallStatus(
  checks: ReadinessStatus['checks']
): 'healthy' | 'degraded' | 'unhealthy' {
  // If database or redis are unhealthy, the service is unhealthy
  if (checks.database.status === 'unhealthy' || checks.redis.status === 'unhealthy') {
    return 'unhealthy';
  }

  // If queues are degraded or unhealthy, service is degraded
  if (checks.queues.status === 'degraded' || checks.queues.status === 'unhealthy') {
    return 'degraded';
  }

  return 'healthy';
}

export default router;
