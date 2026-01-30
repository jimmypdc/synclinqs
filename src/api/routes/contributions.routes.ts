import { Router } from 'express';
import { ContributionsController } from '../controllers/contributions.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

export const contributionsRouter = Router();
const controller = new ContributionsController();

// All routes require authentication
contributionsRouter.use(authenticate);

contributionsRouter.post('/', controller.create);
contributionsRouter.get('/', controller.list);
contributionsRouter.get('/:id', controller.getById);
contributionsRouter.patch('/:id', controller.update);
contributionsRouter.delete('/:id', authorize('ADMIN'), controller.delete);
