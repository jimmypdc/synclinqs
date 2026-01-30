import { Router } from 'express';
import { IntegrationsController } from '../controllers/integrations.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

export const integrationsRouter = Router();
const controller = new IntegrationsController();

// All routes require authentication
integrationsRouter.use(authenticate);

integrationsRouter.post('/sync', authorize('ADMIN', 'USER'), controller.triggerSync);
integrationsRouter.get('/status', controller.getStatus);
integrationsRouter.get('/', controller.list);
integrationsRouter.get('/:id', controller.getById);
integrationsRouter.post('/', authorize('ADMIN'), controller.create);
integrationsRouter.patch('/:id', authorize('ADMIN'), controller.update);
