import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { EmployeesService } from '../../services/employees.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const createEmployeeSchema = z.object({
  planId: z.string().uuid(),
  employeeNumber: z.string().min(1).max(50),
  ssn: z.string().regex(/^\d{9}$/, 'SSN must be 9 digits'),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  dateOfBirth: z.string().datetime().optional(),
  hireDate: z.string().datetime(),
});

const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  terminationDate: z.string().datetime().optional(),
  status: z.enum(['ACTIVE', 'TERMINATED', 'ON_LEAVE', 'SUSPENDED']).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  planId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'TERMINATED', 'ON_LEAVE', 'SUSPENDED']).optional(),
  search: z.string().optional(),
});

export class EmployeesController {
  private service = new EmployeesService();

  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = createEmployeeSchema.parse(req.body);
      const employee = await this.service.create(data, req.user!.organizationId, req.user!.userId);
      res.status(201).json(employee);
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
      const employee = await this.service.getById(id!, req.user!.organizationId);
      res.json(employee);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data = updateEmployeeSchema.parse(req.body);
      const employee = await this.service.update(id!, data, req.user!.userId);
      res.json(employee);
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
