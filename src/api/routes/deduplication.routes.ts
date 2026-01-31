import { Router } from 'express';
import { DeduplicationController } from '../controllers/deduplication.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenantContext.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import { organizationRateLimiter, trackApiUsage } from '../middleware/organizationRateLimiter.js';

export const deduplicationRouter = Router();
const controller = new DeduplicationController();

// All routes require authentication and tenant context
deduplicationRouter.use(authenticate);
deduplicationRouter.use(tenantContext);
deduplicationRouter.use(organizationRateLimiter);
deduplicationRouter.use(trackApiUsage);

// Statistics and checks
deduplicationRouter.get('/stats', controller.getStats);
deduplicationRouter.post('/check', controller.check);

// Scan
deduplicationRouter.post('/scan', idempotencyMiddleware, controller.scan);

// Records
deduplicationRouter.get('/records', controller.list);
deduplicationRouter.get('/records/:id', controller.getById);
deduplicationRouter.patch('/records/:id', controller.resolve);
deduplicationRouter.post('/records/:id/merge', authorize('ADMIN'), controller.merge);
