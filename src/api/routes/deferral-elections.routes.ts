import { Router } from 'express';
import { DeferralElectionsController } from '../controllers/deferral-elections.controller.js';
import { authenticate } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenantContext.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import { organizationRateLimiter, trackApiUsage } from '../middleware/organizationRateLimiter.js';

export const deferralElectionsRouter = Router();
const controller = new DeferralElectionsController();

// All routes require authentication and tenant context
deferralElectionsRouter.use(authenticate);
deferralElectionsRouter.use(tenantContext);
deferralElectionsRouter.use(organizationRateLimiter);
deferralElectionsRouter.use(trackApiUsage);

deferralElectionsRouter.post('/', idempotencyMiddleware, controller.create);
deferralElectionsRouter.get('/', controller.list);
deferralElectionsRouter.get('/employee/:employeeId/active', controller.getActiveForEmployee);
deferralElectionsRouter.get('/:id', controller.getById);
deferralElectionsRouter.patch('/:id', idempotencyMiddleware, controller.update);
deferralElectionsRouter.delete('/:id', controller.delete);
