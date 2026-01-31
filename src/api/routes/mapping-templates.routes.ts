import { Router } from 'express';
import { MappingTemplatesController } from '../controllers/mapping-templates.controller.js';
import { authenticate } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenantContext.js';
import { organizationRateLimiter, trackApiUsage } from '../middleware/organizationRateLimiter.js';

export const mappingTemplatesRouter = Router();
const controller = new MappingTemplatesController();

// All routes require authentication and tenant context
mappingTemplatesRouter.use(authenticate);
mappingTemplatesRouter.use(tenantContext);
mappingTemplatesRouter.use(organizationRateLimiter);
mappingTemplatesRouter.use(trackApiUsage);

// Template operations (read-only for regular users)
mappingTemplatesRouter.get('/', controller.list);
mappingTemplatesRouter.get('/popular', controller.getPopular);
mappingTemplatesRouter.get('/:id', controller.getById);
