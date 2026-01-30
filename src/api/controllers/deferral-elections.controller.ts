import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { DeferralElectionsService } from '../../services/deferral-elections.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

// Percentages are provided as numbers (e.g., 6 for 6%) and converted to basis points
const createElectionSchema = z.object({
  employeeId: z.string().uuid(),
  preTaxPercent: z.number().min(0).max(100),
  rothPercent: z.number().min(0).max(100).optional(),
  catchUpPercent: z.number().min(0).max(100).optional(),
  effectiveDate: z.string().datetime(),
}).refine((data) => {
  const total = data.preTaxPercent + (data.rothPercent ?? 0) + (data.catchUpPercent ?? 0);
  return total <= 100;
}, { message: 'Total deferral percentage cannot exceed 100%' });

const updateElectionSchema = z.object({
  preTaxPercent: z.number().min(0).max(100).optional(),
  rothPercent: z.number().min(0).max(100).optional(),
  catchUpPercent: z.number().min(0).max(100).optional(),
  effectiveDate: z.string().datetime().optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'SUPERSEDED', 'CANCELLED']).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  employeeId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'SUPERSEDED', 'CANCELLED']).optional(),
});

export class DeferralElectionsController {
  private service = new DeferralElectionsService();

  /**
   * Create a new deferral election
   */
  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = createElectionSchema.parse(req.body);
      // Convert percentages to basis points (6% -> 600)
      const result = await this.service.create(
        {
          employeeId: data.employeeId,
          preTaxPercent: Math.round(data.preTaxPercent * 100),
          rothPercent: data.rothPercent ? Math.round(data.rothPercent * 100) : undefined,
          catchUpPercent: data.catchUpPercent ? Math.round(data.catchUpPercent * 100) : undefined,
          effectiveDate: data.effectiveDate,
        },
        req.user!.organizationId,
        req.user!.userId
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * List deferral elections
   */
  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = listQuerySchema.parse(req.query);
      const result = await this.service.list(query, req.user!.organizationId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get deferral election by ID
   */
  getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await this.service.getById(id!, req.user!.organizationId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get active election for an employee
   */
  getActiveForEmployee = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { employeeId } = req.params;
      const result = await this.service.getActiveForEmployee(employeeId!, req.user!.organizationId);
      if (!result) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'No active deferral election found for this employee',
          },
        });
        return;
      }
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update a deferral election
   */
  update = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data = updateElectionSchema.parse(req.body);
      // Convert percentages to basis points if provided
      const result = await this.service.update(
        id!,
        {
          preTaxPercent: data.preTaxPercent !== undefined ? Math.round(data.preTaxPercent * 100) : undefined,
          rothPercent: data.rothPercent !== undefined ? Math.round(data.rothPercent * 100) : undefined,
          catchUpPercent: data.catchUpPercent !== undefined ? Math.round(data.catchUpPercent * 100) : undefined,
          effectiveDate: data.effectiveDate,
          status: data.status,
        },
        req.user!.organizationId,
        req.user!.userId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete a deferral election (only pending elections)
   */
  delete = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.service.delete(id!, req.user!.organizationId, req.user!.userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
