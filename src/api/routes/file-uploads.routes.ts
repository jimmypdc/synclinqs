import { Router } from 'express';
import { FileUploadsController } from '../controllers/file-uploads.controller.js';
import { authenticate } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenantContext.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import { organizationRateLimiter, trackApiUsage } from '../middleware/organizationRateLimiter.js';

export const fileUploadsRouter = Router();
const controller = new FileUploadsController();

// All routes require authentication and tenant context
fileUploadsRouter.use(authenticate);
fileUploadsRouter.use(tenantContext);
fileUploadsRouter.use(organizationRateLimiter);
fileUploadsRouter.use(trackApiUsage);

fileUploadsRouter.post('/', idempotencyMiddleware, controller.upload);
fileUploadsRouter.get('/', controller.list);
fileUploadsRouter.get('/template', controller.getSampleCsv);
fileUploadsRouter.get('/:id', controller.getById);
