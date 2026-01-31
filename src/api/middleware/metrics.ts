import { Request, Response, NextFunction } from 'express';
import {
  httpRequestDuration,
  httpRequestsTotal,
  httpActiveRequests,
} from '../../lib/metrics.js';

/**
 * Normalize route path for metrics
 * Replaces dynamic segments with placeholders to avoid high cardinality
 */
function normalizeRoute(path: string): string {
  // Replace UUIDs with :id
  let normalized = path.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id'
  );

  // Replace numeric IDs with :id
  normalized = normalized.replace(/\/\d+(?=\/|$)/g, '/:id');

  // Remove query strings
  normalized = normalized.split('?')[0] || normalized;

  // Remove trailing slashes
  normalized = normalized.replace(/\/$/, '') || '/';

  return normalized;
}

/**
 * Metrics middleware
 * Records HTTP request duration, count, and active requests
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip metrics endpoint to avoid recursion
  if (req.path === '/metrics') {
    next();
    return;
  }

  const start = process.hrtime.bigint();

  // Increment active requests
  httpActiveRequests.inc();

  // Capture response finish
  res.on('finish', () => {
    // Calculate duration in seconds
    const end = process.hrtime.bigint();
    const durationNs = Number(end - start);
    const durationSeconds = durationNs / 1e9;

    // Get normalized route
    const route = normalizeRoute(req.route?.path || req.path);

    // Record metrics
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };

    httpRequestDuration.observe(labels, durationSeconds);
    httpRequestsTotal.inc(labels);

    // Decrement active requests
    httpActiveRequests.dec();
  });

  // Handle connection close (client disconnect)
  res.on('close', () => {
    if (!res.writableFinished) {
      httpActiveRequests.dec();
    }
  });

  next();
}
