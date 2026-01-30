import { Router } from 'express';
import { FileUploadsController } from '../controllers/file-uploads.controller.js';
import { authenticate } from '../middleware/auth.js';

export const fileUploadsRouter = Router();
const controller = new FileUploadsController();

// All routes require authentication
fileUploadsRouter.use(authenticate);

fileUploadsRouter.post('/', controller.upload);
fileUploadsRouter.get('/', controller.list);
fileUploadsRouter.get('/template', controller.getSampleCsv);
fileUploadsRouter.get('/:id', controller.getById);
