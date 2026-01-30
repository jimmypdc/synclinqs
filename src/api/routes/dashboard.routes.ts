import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenantContext.js';
import { organizationRateLimiter, trackApiUsage } from '../middleware/organizationRateLimiter.js';

export const dashboardRouter = Router();
const controller = new DashboardController();

// All routes require authentication and tenant context
dashboardRouter.use(authenticate);
dashboardRouter.use(tenantContext);
dashboardRouter.use(organizationRateLimiter);
dashboardRouter.use(trackApiUsage);

// Overall stats
dashboardRouter.get('/stats', controller.getStats);

// Contribution reports
dashboardRouter.get('/contributions/summary', controller.getContributionSummary);
dashboardRouter.get('/contributions/trends', controller.getContributionTrends);

// Sync status
dashboardRouter.get('/sync-status', controller.getSyncStatus);

// Audit logs
dashboardRouter.get('/audit-logs', controller.getAuditLogs);
