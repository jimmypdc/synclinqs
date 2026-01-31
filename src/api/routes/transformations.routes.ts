import { Router } from 'express';
import { TransformationsController } from '../controllers/transformations.controller.js';
import { authenticate } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenantContext.js';
import { organizationRateLimiter, trackApiUsage } from '../middleware/organizationRateLimiter.js';

export const transformationsRouter = Router();
const controller = new TransformationsController();

// All routes require authentication and tenant context
transformationsRouter.use(authenticate);
transformationsRouter.use(tenantContext);
transformationsRouter.use(organizationRateLimiter);
transformationsRouter.use(trackApiUsage);

// List and get transformations
transformationsRouter.get('/', controller.list);
transformationsRouter.get('/categories', controller.getCategories);
transformationsRouter.get('/:name', controller.getByName);

// Test transformations
transformationsRouter.post('/test', controller.test);
transformationsRouter.post('/chain', controller.chain);
