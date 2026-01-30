import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { ContributionsService } from '../../services/contributions.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const createContributionSchema = z.object({
  employeeId: z.string().uuid(),
  planId: z.string().uuid(),
  payrollDate: z.string().datetime(),
  employeePreTax: z.number().int().min(0),
  employeeRoth: z.number().int().min(0).optional(),
  employerMatch: z.number().int().min(0).optional(),
  employerNonMatch: z.number().int().min(0).optional(),
  loanRepayment: z.number().int().min(0).optional(),
  idempotencyKey: z.string().optional(),
});

const updateContributionSchema = z.object({
  employeePreTax: z.number().int().min(0).optional(),
  employeeRoth: z.number().int().min(0).optional(),
  employerMatch: z.number().int().min(0).optional(),
  employerNonMatch: z.number().int().min(0).optional(),
  loanRepayment: z.number().int().min(0).optional(),
  status: z.enum(['PENDING', 'VALIDATED', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'CANCELLED']).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  employeeId: z.string().uuid().optional(),
  planId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'VALIDATED', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'CANCELLED']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export class ContributionsController {
  private service = new ContributionsService();

  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = createContributionSchema.parse(req.body);
      const contribution = await this.service.create(data, req.user!.userId);
      res.status(201).json(contribution);
    } catch (error) {
      next(error);
    }
  };

  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = listQuerySchema.parse(req.query);
      const result = await this.service.list(query, req.user!.organizationId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const contribution = await this.service.getById(id!, req.user!.organizationId);
      res.json(contribution);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data = updateContributionSchema.parse(req.body);
      const contribution = await this.service.update(id!, data, req.user!.userId);
      res.json(contribution);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.service.delete(id!, req.user!.userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
