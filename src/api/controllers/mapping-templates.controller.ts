import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { MappingTemplateService } from '../../services/mapping-template.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const listTemplatesQuerySchema = z.object({
  sourceSystem: z.string().optional(),
  destinationSystem: z.string().optional(),
  mappingType: z.enum(['CONTRIBUTION', 'EMPLOYEE', 'ELECTION', 'LOAN']).optional(),
  isVerified: z.coerce.boolean().optional(),
});

export class MappingTemplatesController {
  private service = new MappingTemplateService();

  list = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = listTemplatesQuerySchema.parse(req.query);
      const result = await this.service.list(query);
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
      const result = await this.service.getById(id!);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getPopular = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
      const result = await this.service.getPopular(limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
