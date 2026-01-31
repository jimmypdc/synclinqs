import { Router, Request, Response } from 'express';
import { getMetrics, getContentType } from '../../lib/metrics.js';
import { logger } from '../../utils/logger.js';

const router = Router();

/**
 * GET /metrics
 * Prometheus metrics endpoint
 *
 * Returns metrics in Prometheus text format for scraping.
 * Should be protected in production (e.g., only accessible from internal network).
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const metrics = await getMetrics();
    res.set('Content-Type', getContentType());
    res.send(metrics);
  } catch (error) {
    logger.error('Error generating metrics', { error: (error as Error).message });
    res.status(500).send('Error generating metrics');
  }
});

export default router;
