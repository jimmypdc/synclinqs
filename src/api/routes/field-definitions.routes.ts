import { Router } from 'express';
import { FieldDefinitionsController } from '../controllers/field-definitions.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenantContext.js';
import { organizationRateLimiter, trackApiUsage } from '../middleware/organizationRateLimiter.js';

export const fieldDefinitionsRouter = Router();
const controller = new FieldDefinitionsController();

// All routes require authentication and tenant context
fieldDefinitionsRouter.use(authenticate);
fieldDefinitionsRouter.use(tenantContext);
fieldDefinitionsRouter.use(organizationRateLimiter);
fieldDefinitionsRouter.use(trackApiUsage);

// Read operations (available to all authenticated users)
fieldDefinitionsRouter.get('/', controller.list);
fieldDefinitionsRouter.get('/systems', controller.getSystems);
fieldDefinitionsRouter.get('/system/:systemName', controller.getFieldsForSystem);
fieldDefinitionsRouter.get('/:id', controller.getById);

// Write operations (admin only)
fieldDefinitionsRouter.post('/', authorize('ADMIN'), controller.create);
fieldDefinitionsRouter.patch('/:id', authorize('ADMIN'), controller.update);
fieldDefinitionsRouter.delete('/:id', authorize('ADMIN'), controller.delete);
fieldDefinitionsRouter.post('/system/:systemName/bulk-import', authorize('ADMIN'), controller.bulkImport);
