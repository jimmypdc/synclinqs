import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { DeduplicationService } from '../../services/deduplication.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z
    .enum(['POTENTIAL_DUPLICATE', 'CONFIRMED_DUPLICATE', 'NOT_DUPLICATE', 'MERGED'])
    .optional(),
  recordType: z.enum(['contribution', 'employee', 'election', 'loan']).optional(),
  minMatchScore: z.coerce.number().min(0).max(1).optional(),
  maxMatchScore: z.coerce.number().min(0).max(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const resolveSchema = z.object({
  status: z.enum(['POTENTIAL_DUPLICATE', 'CONFIRMED_DUPLICATE', 'NOT_DUPLICATE', 'MERGED']),
  resolutionNotes: z.string().max(1000).optional(),
});

const mergeSchema = z.object({
  keepRecordId: z.string().uuid(),
  mergeRecordId: z.string().uuid(),
  fieldOverrides: z.record(z.unknown()).optional(),
});

const scanSchema = z.object({
  recordType: z.enum(['contribution', 'employee', 'election', 'loan']),
  scope: z.enum(['all', 'recent', 'unscanned']).optional(),
  minMatchScore: z.number().min(0).max(1).optional(),
  fields: z.array(z.string()).optional(),
  dryRun: z.boolean().optional(),
});

const checkDuplicateSchema = z.object({
  recordType: z.enum(['contribution', 'employee', 'election', 'loan']),
  recordData: z.record(z.unknown()),
});

export class DeduplicationController {
  private service = new DeduplicationService();

  /**
   * GET /api/v1/deduplication/records
   * List deduplication records
   */
  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = listQuerySchema.parse(req.query);
      const result = await this.service.listRecords(req.user!.organizationId, query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/deduplication/records/:id
   * Get deduplication record details
   */
  getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const record = await this.service.getRecordById(id!, req.user!.organizationId);
      res.json(record);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/v1/deduplication/records/:id
   * Resolve a deduplication record
   */
  resolve = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data = resolveSchema.parse(req.body);
      const record = await this.service.resolveRecord(
        id!,
        req.user!.organizationId,
        data,
        req.user!.userId
      );
      res.json(record);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/deduplication/records/:id/merge
   * Merge duplicate records
   */
  merge = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data = mergeSchema.parse(req.body);
      const result = await this.service.mergeRecords(
        id!,
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
   * POST /api/v1/deduplication/scan
   * Run a deduplication scan
   */
  scan = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = scanSchema.parse(req.body);
      const result = await this.service.runScan(
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
   * POST /api/v1/deduplication/check
   * Check if a record is a potential duplicate
   */
  check = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = checkDuplicateSchema.parse(req.body);
      const result = await this.service.checkDuplicate(
        req.user!.organizationId,
        data.recordType,
        data.recordData
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/deduplication/stats
   * Get deduplication statistics
   */
  getStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.service.getStats(req.user!.organizationId);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  };
}
