import { Router } from 'express';
import { EmployeesController } from '../controllers/employees.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenantContext.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import { organizationRateLimiter, trackApiUsage } from '../middleware/organizationRateLimiter.js';

export const employeesRouter = Router();
const controller = new EmployeesController();

// All routes require authentication and tenant context
employeesRouter.use(authenticate);
employeesRouter.use(tenantContext);
employeesRouter.use(organizationRateLimiter);
employeesRouter.use(trackApiUsage);

employeesRouter.post('/', idempotencyMiddleware, controller.create);
employeesRouter.get('/', controller.list);
employeesRouter.get('/:id', controller.getById);
employeesRouter.patch('/:id', idempotencyMiddleware, controller.update);
employeesRouter.delete('/:id', authorize('ADMIN'), controller.delete);
