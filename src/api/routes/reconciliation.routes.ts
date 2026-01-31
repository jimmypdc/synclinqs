import { Router } from 'express';
import { ReconciliationController } from '../controllers/reconciliation.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenantContext.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import { organizationRateLimiter, trackApiUsage } from '../middleware/organizationRateLimiter.js';

export const reconciliationRouter = Router();
const controller = new ReconciliationController();

// All routes require authentication and tenant context
reconciliationRouter.use(authenticate);
reconciliationRouter.use(tenantContext);
reconciliationRouter.use(organizationRateLimiter);
reconciliationRouter.use(trackApiUsage);

// Dashboard
reconciliationRouter.get('/dashboard', controller.getDashboard);

// Reports
reconciliationRouter.get('/reports', controller.listReports);
reconciliationRouter.post('/run', idempotencyMiddleware, controller.run);
reconciliationRouter.get('/reports/:id', controller.getReport);
reconciliationRouter.get('/reports/:id/items', controller.listItems);

// Items
reconciliationRouter.patch('/items/:id', controller.resolveItem);
reconciliationRouter.post('/items/bulk-resolve', controller.bulkResolve);
