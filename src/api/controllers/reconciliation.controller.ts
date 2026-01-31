import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { ReconciliationService } from '../../services/reconciliation.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const runReconciliationSchema = z.object({
  sourceSystem: z.string().min(1).max(100),
  destinationSystem: z.string().min(1).max(100),
  reconciliationType: z.enum(['CONTRIBUTION', 'EMPLOYEE', 'ELECTION', 'LOAN']),
  reconciliationDate: z.string().datetime(),
  tolerance: z
    .object({
      amountToleranceCents: z.number().int().min(0).optional(),
      percentageTolerance: z.number().min(0).max(1).optional(),
      dateTolerance: z.number().int().min(0).optional(),
    })
    .optional(),
});

const listReportsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'RECONCILED', 'DISCREPANCIES_FOUND', 'FAILED']).optional(),
  sourceSystem: z.string().optional(),
  destinationSystem: z.string().optional(),
  reconciliationType: z.enum(['CONTRIBUTION', 'EMPLOYEE', 'ELECTION', 'LOAN']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const listItemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  matchStatus: z
    .enum(['MATCHED', 'SOURCE_ONLY', 'DESTINATION_ONLY', 'AMOUNT_MISMATCH', 'DATA_MISMATCH'])
    .optional(),
  hasDiscrepancy: z.coerce.boolean().optional(),
  resolved: z.coerce.boolean().optional(),
});

const resolveItemSchema = z.object({
  resolutionAction: z.enum(['AUTO_CORRECTED', 'MANUAL_REVIEW', 'IGNORED', 'ADJUSTED']),
  resolutionNotes: z.string().max(1000).optional(),
});

const bulkResolveSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1).max(100),
  resolutionAction: z.enum(['AUTO_CORRECTED', 'MANUAL_REVIEW', 'IGNORED', 'ADJUSTED']),
  resolutionNotes: z.string().max(1000).optional(),
});

export class ReconciliationController {
  private service = new ReconciliationService();

  /**
   * POST /api/v1/reconciliation/run
   * Trigger a new reconciliation
   */
  run = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = runReconciliationSchema.parse(req.body);
      const tolerance = data.tolerance
        ? {
            amountToleranceCents: data.tolerance.amountToleranceCents ?? 100,
            percentageTolerance: data.tolerance.percentageTolerance ?? 0.01,
            dateTolerance: data.tolerance.dateTolerance ?? 1,
          }
        : undefined;
      const result = await this.service.performReconciliation(
        req.user!.organizationId,
        {
          sourceSystem: data.sourceSystem,
          destinationSystem: data.destinationSystem,
          reconciliationType: data.reconciliationType,
          reconciliationDate: new Date(data.reconciliationDate),
        },
        req.user!.userId,
        tolerance
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/reconciliation/reports
   * List reconciliation reports
   */
  listReports = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = listReportsQuerySchema.parse(req.query);
      const result = await this.service.listReports(req.user!.organizationId, query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/reconciliation/reports/:id
   * Get report details
   */
  getReport = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const report = await this.service.getReportById(id!, req.user!.organizationId);
      res.json(report);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/reconciliation/reports/:id/items
   * List items for a report
   */
  listItems = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const query = listItemsQuerySchema.parse(req.query);
      const result = await this.service.listItems(id!, req.user!.organizationId, query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/v1/reconciliation/items/:id
   * Resolve a reconciliation item
   */
  resolveItem = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data = resolveItemSchema.parse(req.body);
      const item = await this.service.resolveItem(
        id!,
        req.user!.organizationId,
        data,
        req.user!.userId
      );
      res.json(item);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/reconciliation/items/bulk-resolve
   * Bulk resolve items
   */
  bulkResolve = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = bulkResolveSchema.parse(req.body);
      const result = await this.service.bulkResolve(
        req.user!.organizationId,
        data,
        req.user!.userId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/reconciliation/dashboard
   * Get reconciliation dashboard metrics
   */
  getDashboard = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dashboard = await this.service.getDashboard(req.user!.organizationId);
      res.json(dashboard);
    } catch (error) {
      next(error);
    }
  };
}
