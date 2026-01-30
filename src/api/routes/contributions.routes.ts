import { Router } from 'express';
import { ContributionsController } from '../controllers/contributions.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenantContext.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import { organizationRateLimiter, trackApiUsage } from '../middleware/organizationRateLimiter.js';

export const contributionsRouter = Router();
const controller = new ContributionsController();

// All routes require authentication and tenant context
contributionsRouter.use(authenticate);
contributionsRouter.use(tenantContext);
contributionsRouter.use(organizationRateLimiter);
contributionsRouter.use(trackApiUsage);

contributionsRouter.post('/', idempotencyMiddleware, controller.create);
contributionsRouter.post('/validate', controller.validate);
contributionsRouter.get('/', controller.list);
contributionsRouter.get('/ytd/:employeeId', controller.getYtdTotals);
contributionsRouter.get('/:id', controller.getById);
contributionsRouter.patch('/:id', idempotencyMiddleware, controller.update);
contributionsRouter.delete('/:id', authorize('ADMIN'), controller.delete);
