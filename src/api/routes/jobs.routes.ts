import { Router } from 'express';
import { JobsController } from '../controllers/jobs.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenantContext.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import { organizationRateLimiter, trackApiUsage } from '../middleware/organizationRateLimiter.js';

export const jobsRouter = Router();
const controller = new JobsController();

// All routes require authentication and tenant context
jobsRouter.use(authenticate);
jobsRouter.use(tenantContext);
jobsRouter.use(organizationRateLimiter);
jobsRouter.use(trackApiUsage);

// Job CRUD
jobsRouter.get('/', controller.list);
jobsRouter.post('/', authorize('ADMIN'), controller.create);
jobsRouter.get('/stats', controller.getStats);
jobsRouter.post('/validate-cron', controller.validateCron);
jobsRouter.get('/:id', controller.getById);
jobsRouter.patch('/:id', authorize('ADMIN'), controller.update);
jobsRouter.delete('/:id', authorize('ADMIN'), controller.delete);

// Job execution
jobsRouter.post('/:id/run', idempotencyMiddleware, controller.execute);
jobsRouter.get('/:id/executions', controller.listExecutions);
