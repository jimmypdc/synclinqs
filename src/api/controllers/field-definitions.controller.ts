import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { FieldDefinitionService } from '../../services/field-definition.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const listFieldsQuerySchema = z.object({
  systemName: z.string().optional(),
  isPii: z.coerce.boolean().optional(),
  isRequired: z.coerce.boolean().optional(),
});

const createFieldSchema = z.object({
  systemName: z.string().min(1).max(100),
  fieldName: z.string().min(1).max(255),
  displayName: z.string().min(1).max(255),
  dataType: z.enum(['STRING', 'NUMBER', 'DATE', 'BOOLEAN', 'ARRAY', 'OBJECT']),
  formatPattern: z.string().optional(),
  isRequired: z.boolean().optional(),
  isPii: z.boolean().optional(),
  validationRules: z.record(z.unknown()).optional(),
  description: z.string().optional(),
  exampleValue: z.string().optional(),
});

const updateFieldSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  formatPattern: z.string().optional(),
  isRequired: z.boolean().optional(),
  isPii: z.boolean().optional(),
  validationRules: z.record(z.unknown()).optional(),
  description: z.string().optional(),
  exampleValue: z.string().optional(),
});

const bulkImportSchema = z.object({
  fields: z.array(createFieldSchema.omit({ systemName: true })).min(1).max(500),
});

export class FieldDefinitionsController {
  private service = new FieldDefinitionService();

  list = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = listFieldsQuerySchema.parse(req.query);
      const result = await this.service.list(query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getSystems = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.service.getSystems();
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getFieldsForSystem = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { systemName } = req.params;
      const result = await this.service.getFieldsForSystem(systemName!);
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

  create = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = createFieldSchema.parse(req.body);
      const result = await this.service.create(data);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  update = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const data = updateFieldSchema.parse(req.body);
      const result = await this.service.update(id!, data);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  delete = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      await this.service.delete(id!);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  bulkImport = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { systemName } = req.params;
      const { fields } = bulkImportSchema.parse(req.body);
      const fieldsWithSystem = fields.map((f) => ({ ...f, systemName: systemName! }));
      const result = await this.service.bulkImport(systemName!, fieldsWithSystem);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
