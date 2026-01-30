import { Router } from 'express';
import { IntegrationsController } from '../controllers/integrations.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenantContext.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import { organizationRateLimiter, trackApiUsage } from '../middleware/organizationRateLimiter.js';

export const integrationsRouter = Router();
const controller = new IntegrationsController();

// All routes require authentication and tenant context
integrationsRouter.use(authenticate);
integrationsRouter.use(tenantContext);
integrationsRouter.use(organizationRateLimiter);
integrationsRouter.use(trackApiUsage);

integrationsRouter.post('/sync', idempotencyMiddleware, authorize('ADMIN', 'USER'), controller.triggerSync);
integrationsRouter.get('/status', controller.getStatus);
integrationsRouter.get('/', controller.list);
integrationsRouter.get('/:id', controller.getById);
integrationsRouter.post('/', idempotencyMiddleware, authorize('ADMIN'), controller.create);
integrationsRouter.patch('/:id', idempotencyMiddleware, authorize('ADMIN'), controller.update);
