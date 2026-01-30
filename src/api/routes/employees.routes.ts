import { Router } from 'express';
import { EmployeesController } from '../controllers/employees.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

export const employeesRouter = Router();
const controller = new EmployeesController();

// All routes require authentication
employeesRouter.use(authenticate);

employeesRouter.post('/', controller.create);
employeesRouter.get('/', controller.list);
employeesRouter.get('/:id', controller.getById);
employeesRouter.patch('/:id', controller.update);
employeesRouter.delete('/:id', authorize('ADMIN'), controller.delete);
