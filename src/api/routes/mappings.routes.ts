import { Router } from 'express';
import { MappingsController } from '../controllers/mappings.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenantContext.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import { organizationRateLimiter, trackApiUsage } from '../middleware/organizationRateLimiter.js';

export const mappingsRouter = Router();
const controller = new MappingsController();

// All routes require authentication and tenant context
mappingsRouter.use(authenticate);
mappingsRouter.use(tenantContext);
mappingsRouter.use(organizationRateLimiter);
mappingsRouter.use(trackApiUsage);

// CRUD operations
mappingsRouter.get('/', controller.list);
mappingsRouter.post('/', idempotencyMiddleware, controller.create);
mappingsRouter.get('/:id', controller.getById);
mappingsRouter.patch('/:id', idempotencyMiddleware, controller.update);
mappingsRouter.delete('/:id', authorize('ADMIN'), controller.delete);

// Special operations
mappingsRouter.post('/:id/test', controller.test);
mappingsRouter.post('/:id/activate', idempotencyMiddleware, authorize('ADMIN'), controller.activate);
mappingsRouter.post('/:id/deactivate', idempotencyMiddleware, authorize('ADMIN'), controller.deactivate);
mappingsRouter.get('/:id/logs', controller.getLogs);

// Create from template
mappingsRouter.post('/from-template/:templateId', idempotencyMiddleware, controller.createFromTemplate);
