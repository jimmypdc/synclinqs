import { Router } from 'express';
import { NotificationsController } from '../controllers/notifications.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenantContext.js';
import { organizationRateLimiter, trackApiUsage } from '../middleware/organizationRateLimiter.js';

export const notificationsRouter = Router();
export const alertRulesRouter = Router();
const controller = new NotificationsController();

// Notifications routes
notificationsRouter.use(authenticate);
notificationsRouter.use(tenantContext);
notificationsRouter.use(organizationRateLimiter);
notificationsRouter.use(trackApiUsage);

notificationsRouter.get('/', controller.list);
notificationsRouter.get('/unread-count', controller.getUnreadCount);
notificationsRouter.patch('/:id/read', controller.markAsRead);
notificationsRouter.post('/mark-all-read', controller.markAllAsRead);
notificationsRouter.get('/preferences', controller.getPreferences);
notificationsRouter.put('/preferences', controller.updatePreferences);

// Alert rules routes
alertRulesRouter.use(authenticate);
alertRulesRouter.use(tenantContext);
alertRulesRouter.use(organizationRateLimiter);
alertRulesRouter.use(trackApiUsage);

alertRulesRouter.get('/', controller.listAlertRules);
alertRulesRouter.post('/', authorize('ADMIN'), controller.createAlertRule);
alertRulesRouter.patch('/:id', authorize('ADMIN'), controller.updateAlertRule);
alertRulesRouter.delete('/:id', authorize('ADMIN'), controller.deleteAlertRule);
