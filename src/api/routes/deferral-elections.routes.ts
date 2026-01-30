import { Router } from 'express';
import { DeferralElectionsController } from '../controllers/deferral-elections.controller.js';
import { authenticate } from '../middleware/auth.js';

export const deferralElectionsRouter = Router();
const controller = new DeferralElectionsController();

// All routes require authentication
deferralElectionsRouter.use(authenticate);

deferralElectionsRouter.post('/', controller.create);
deferralElectionsRouter.get('/', controller.list);
deferralElectionsRouter.get('/employee/:employeeId/active', controller.getActiveForEmployee);
deferralElectionsRouter.get('/:id', controller.getById);
deferralElectionsRouter.patch('/:id', controller.update);
deferralElectionsRouter.delete('/:id', controller.delete);
