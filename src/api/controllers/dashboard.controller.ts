import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { DashboardService } from '../../services/dashboard.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const trendsQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(6),
});

const auditLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export class DashboardController {
  private service = new DashboardService();

  /**
   * Get overall dashboard statistics
   */
  getStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getDashboardStats(req.user!.organizationId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get contribution summary
   */
  getContributionSummary = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = dateRangeSchema.parse(req.query);
      const dateRange = query.startDate && query.endDate
        ? { startDate: new Date(query.startDate), endDate: new Date(query.endDate) }
        : undefined;

      const result = await this.service.getContributionSummary(req.user!.organizationId, dateRange);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get contribution trends
   */
  getContributionTrends = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = trendsQuerySchema.parse(req.query);
      const result = await this.service.getContributionTrends(req.user!.organizationId, query.months);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get sync status summary
   */
  getSyncStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getSyncStatus(req.user!.organizationId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get recent audit logs
   */
  getAuditLogs = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = auditLogsQuerySchema.parse(req.query);
      const result = await this.service.getRecentAuditLogs(req.user!.organizationId, query.limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
