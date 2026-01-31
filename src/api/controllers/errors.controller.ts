import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { ErrorQueueService } from '../../services/error-queue.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const listErrorsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(['PENDING', 'RETRYING', 'RESOLVED', 'FAILED_PERMANENTLY', 'MANUAL_REVIEW', 'IGNORED']).optional(),
  errorType: z.enum([
    'MAPPING_ERROR', 'VALIDATION_ERROR', 'API_ERROR', 'FILE_FORMAT_ERROR',
    'NETWORK_ERROR', 'TIMEOUT_ERROR', 'RATE_LIMIT_ERROR', 'AUTHENTICATION_ERROR', 'DATA_INTEGRITY_ERROR'
  ]).optional(),
  severity: z.enum(['CRITICAL', 'ERROR', 'WARNING']).optional(),
  sourceSystem: z.string().optional(),
  destinationSystem: z.string().optional(),
  recordType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const resolveErrorSchema = z.object({
  notes: z.string().optional(),
});

const ignoreErrorSchema = z.object({
  reason: z.string().min(1),
});

const bulkRetrySchema = z.object({
  errorIds: z.array(z.string().uuid()).min(1).max(100),
});

export class ErrorsController {
  private service = new ErrorQueueService();

  list = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = listErrorsQuerySchema.parse(req.query);
      const result = await this.service.list(req.user!.organizationId, query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getStats = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.service.getStats(req.user!.organizationId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await this.service.getById(id!, req.user!.organizationId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getRetryLogs = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await this.service.getRetryLogs(id!, req.user!.organizationId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  triggerRetry = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await this.service.triggerRetry(
        id!,
        req.user!.organizationId,
        req.user!.userId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  resolve = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { notes } = resolveErrorSchema.parse(req.body);
      const result = await this.service.resolve(id!, req.user!.organizationId, {
        notes,
        resolvedBy: req.user!.userId,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  ignore = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { reason } = ignoreErrorSchema.parse(req.body);
      const result = await this.service.ignore(id!, req.user!.organizationId, {
        reason,
        ignoredBy: req.user!.userId,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  bulkRetry = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { errorIds } = bulkRetrySchema.parse(req.body);
      const result = await this.service.bulkRetry(
        req.user!.organizationId,
        errorIds,
        req.user!.userId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
