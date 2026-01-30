import { Router } from 'express';
import { InvitationsController } from '../controllers/invitations.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenantContext.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import { organizationRateLimiter, trackApiUsage } from '../middleware/organizationRateLimiter.js';

export const invitationsRouter = Router();
const controller = new InvitationsController();

// Public route - get invitation by token (for accept flow)
invitationsRouter.get('/token/:token', controller.getByToken);

// Protected routes - require authentication and ADMIN role
invitationsRouter.use(authenticate);
invitationsRouter.use(tenantContext);
invitationsRouter.use(organizationRateLimiter);
invitationsRouter.use(trackApiUsage);
invitationsRouter.use(authorize('ADMIN'));

invitationsRouter.post('/', idempotencyMiddleware, controller.create);
invitationsRouter.get('/', controller.list);
invitationsRouter.delete('/:id', controller.revoke);
