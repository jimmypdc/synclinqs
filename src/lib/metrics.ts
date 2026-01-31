import client, {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';
import { logger } from '../utils/logger.js';

// Create a custom registry
const register = new Registry();

// Add default Node.js metrics (memory, CPU, event loop, etc.)
collectDefaultMetrics({ register });

// ==============================================================================
// HTTP Metrics
// ==============================================================================

/**
 * HTTP request duration histogram
 */
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

/**
 * HTTP requests total counter
 */
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

/**
 * Active HTTP requests gauge
 */
export const httpActiveRequests = new Gauge({
  name: 'http_active_requests',
  help: 'Number of active HTTP requests',
  registers: [register],
});

// ==============================================================================
// Cache Metrics
// ==============================================================================

/**
 * Cache operations counter (hit/miss)
 */
export const cacheOperations = new Counter({
  name: 'synclinqs_cache_operations_total',
  help: 'Total cache operations',
  labelNames: ['operation', 'result'], // operation: get/set/delete, result: hit/miss/success/error
  registers: [register],
});

// ==============================================================================
// Business Metrics
// ==============================================================================

/**
 * Contributions processed counter
 */
export const contributionsProcessed = new Counter({
  name: 'synclinqs_contributions_processed_total',
  help: 'Total contributions processed',
  labelNames: ['status', 'organization_id'],
  registers: [register],
});

/**
 * Mapping execution duration histogram
 */
export const mappingExecutionDuration = new Histogram({
  name: 'synclinqs_mapping_execution_seconds',
  help: 'Duration of mapping executions in seconds',
  labelNames: ['mapping_type', 'source_system', 'destination_system'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [register],
});

/**
 * Reconciliation records gauge
 */
export const reconciliationRecords = new Gauge({
  name: 'synclinqs_reconciliation_records',
  help: 'Reconciliation record counts',
  labelNames: ['status', 'organization_id'],
  registers: [register],
});

// ==============================================================================
// Queue Metrics
// ==============================================================================

/**
 * Queue depth gauge
 */
export const queueDepth = new Gauge({
  name: 'synclinqs_queue_depth',
  help: 'Current queue depth by status',
  labelNames: ['queue', 'status'], // status: waiting/active/completed/failed
  registers: [register],
});

/**
 * Job processing duration histogram
 */
export const jobProcessingDuration = new Histogram({
  name: 'synclinqs_job_processing_seconds',
  help: 'Duration of job processing in seconds',
  labelNames: ['queue', 'job_type'],
  buckets: [0.5, 1, 5, 10, 30, 60, 120, 300],
  registers: [register],
});

/**
 * Jobs processed counter
 */
export const jobsProcessed = new Counter({
  name: 'synclinqs_jobs_processed_total',
  help: 'Total jobs processed',
  labelNames: ['queue', 'status'], // status: completed/failed
  registers: [register],
});

// ==============================================================================
// Error Metrics
// ==============================================================================

/**
 * Error queue depth gauge
 */
export const errorQueueDepth = new Gauge({
  name: 'synclinqs_error_queue_depth',
  help: 'Current error queue depth by status',
  labelNames: ['status', 'error_type'],
  registers: [register],
});

/**
 * Errors total counter
 */
export const errorsTotal = new Counter({
  name: 'synclinqs_errors_total',
  help: 'Total errors by type',
  labelNames: ['error_type', 'severity'],
  registers: [register],
});

// ==============================================================================
// Database Metrics
// ==============================================================================

/**
 * Database query duration histogram
 */
export const dbQueryDuration = new Histogram({
  name: 'synclinqs_db_query_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

// ==============================================================================
// Helper Functions
// ==============================================================================

/**
 * Get the Prometheus registry
 */
export function getRegistry(): Registry {
  return register;
}

/**
 * Get metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Get content type for metrics response
 */
export function getContentType(): string {
  return register.contentType;
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  register.resetMetrics();
  logger.debug('Metrics reset');
}

/**
 * Record HTTP request metrics
 */
export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  durationSeconds: number
): void {
  const labels = { method, route, status_code: String(statusCode) };
  httpRequestDuration.observe(labels, durationSeconds);
  httpRequestsTotal.inc(labels);
}

/**
 * Record cache operation
 */
export function recordCacheOperation(
  operation: 'get' | 'set' | 'delete',
  result: 'hit' | 'miss' | 'success' | 'error'
): void {
  cacheOperations.inc({ operation, result });
}

/**
 * Update queue metrics
 */
export function updateQueueMetrics(
  queueName: string,
  counts: { waiting: number; active: number; completed: number; failed: number }
): void {
  queueDepth.set({ queue: queueName, status: 'waiting' }, counts.waiting);
  queueDepth.set({ queue: queueName, status: 'active' }, counts.active);
  queueDepth.set({ queue: queueName, status: 'completed' }, counts.completed);
  queueDepth.set({ queue: queueName, status: 'failed' }, counts.failed);
}
