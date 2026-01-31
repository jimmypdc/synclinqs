import { Router } from 'express';
import { ErrorsController } from '../controllers/errors.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenantContext.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import { organizationRateLimiter, trackApiUsage } from '../middleware/organizationRateLimiter.js';

export const errorsRouter = Router();
const controller = new ErrorsController();

// All routes require authentication and tenant context
errorsRouter.use(authenticate);
errorsRouter.use(tenantContext);
errorsRouter.use(organizationRateLimiter);
errorsRouter.use(trackApiUsage);

// Read operations
errorsRouter.get('/', controller.list);
errorsRouter.get('/stats', controller.getStats);
errorsRouter.get('/:id', controller.getById);
errorsRouter.get('/:id/retries', controller.getRetryLogs);

// Retry operations
errorsRouter.post('/:id/retry', idempotencyMiddleware, controller.triggerRetry);
errorsRouter.post('/bulk-retry', idempotencyMiddleware, authorize('ADMIN'), controller.bulkRetry);

// Resolution operations (admin only for ignore)
errorsRouter.patch('/:id/resolve', idempotencyMiddleware, controller.resolve);
errorsRouter.patch('/:id/ignore', idempotencyMiddleware, authorize('ADMIN'), controller.ignore);
