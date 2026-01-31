import { Router } from 'express';
import { ValidationRulesController } from '../controllers/validation-rules.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenantContext.js';
import { organizationRateLimiter, trackApiUsage } from '../middleware/organizationRateLimiter.js';

export const validationRulesRouter = Router();
const controller = new ValidationRulesController();

// All routes require authentication and tenant context
validationRulesRouter.use(authenticate);
validationRulesRouter.use(tenantContext);
validationRulesRouter.use(organizationRateLimiter);
validationRulesRouter.use(trackApiUsage);

// Read operations
validationRulesRouter.get('/', controller.list);
validationRulesRouter.get('/:id', controller.getById);

// Write operations (admin only)
validationRulesRouter.post('/', authorize('ADMIN'), controller.create);
validationRulesRouter.patch('/:id', authorize('ADMIN'), controller.update);
validationRulesRouter.delete('/:id', authorize('ADMIN'), controller.delete);

// Validate data against rules
validationRulesRouter.post('/validate', controller.validate);
