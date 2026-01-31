import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { MappingService } from '../../services/mapping.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { CreateMappingData, UpdateMappingData, MappingRules } from '../../types/mapping.types.js';

// Validation schemas
const fieldMappingSchema = z.object({
  sourceField: z.string().min(1),
  destinationField: z.string().min(1),
  transformation: z.string().optional(),
  transformationParams: z.record(z.unknown()).optional(),
  required: z.boolean(),
});

const conditionalMappingInnerSchema = z.object({
  destinationField: z.string().min(1),
  value: z.unknown(),
});

const conditionalMappingSchema = z.object({
  condition: z.string().min(1),
  mappings: z.array(conditionalMappingInnerSchema),
});

const calculatedFieldSchema = z.object({
  destinationField: z.string().min(1),
  formula: z.string().min(1),
  rounding: z.enum(['cents', 'dollars', 'none']).optional(),
});

const lookupMappingSchema = z.object({
  sourceField: z.string().min(1),
  lookupTable: z.union([z.string(), z.record(z.unknown())]),
  lookupKey: z.string().min(1),
  lookupValue: z.string().min(1),
  destinationField: z.string().min(1),
  defaultValue: z.unknown().optional(),
});

const defaultValueSchema = z.object({
  destinationField: z.string().min(1),
  value: z.unknown(),
  applyWhen: z.enum(['always', 'if_null', 'if_empty']),
});

const mappingRulesSchema = z.object({
  fieldMappings: z.array(fieldMappingSchema),
  conditionalMappings: z.array(conditionalMappingSchema).optional(),
  calculatedFields: z.array(calculatedFieldSchema).optional(),
  lookupMappings: z.array(lookupMappingSchema).optional(),
  defaultValues: z.array(defaultValueSchema).optional(),
});

const createMappingSchema = z.object({
  name: z.string().min(1).max(255),
  sourceSystem: z.string().min(1).max(100),
  destinationSystem: z.string().min(1).max(100),
  mappingType: z.enum(['CONTRIBUTION', 'EMPLOYEE', 'ELECTION', 'LOAN']),
  mappingRules: mappingRulesSchema,
  templateId: z.string().uuid().optional(),
});

const updateMappingSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  mappingRules: mappingRulesSchema.optional(),
  isActive: z.boolean().optional(),
});

const listMappingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sourceSystem: z.string().optional(),
  destinationSystem: z.string().optional(),
  mappingType: z.enum(['CONTRIBUTION', 'EMPLOYEE', 'ELECTION', 'LOAN']).optional(),
  isActive: z.coerce.boolean().optional(),
});

const testMappingSchema = z.object({
  sampleData: z.array(z.record(z.unknown())).min(1).max(100),
});

const createFromTemplateSchema = z.object({
  customizations: mappingRulesSchema.partial().optional(),
});

export class MappingsController {
  private service = new MappingService();

  create = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = createMappingSchema.parse(req.body) as unknown as CreateMappingData;
      const result = await this.service.create(
        data,
        req.user!.organizationId,
        req.user!.userId
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  list = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = listMappingsQuerySchema.parse(req.query);
      const result = await this.service.list(query, req.user!.organizationId);
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

  update = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const data = updateMappingSchema.parse(req.body) as unknown as UpdateMappingData;
      const result = await this.service.update(
        id!,
        data,
        req.user!.organizationId,
        req.user!.userId
      );
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
      await this.service.delete(id!, req.user!.organizationId, req.user!.userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  test = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { sampleData } = testMappingSchema.parse(req.body);
      const result = await this.service.testMapping(
        id!,
        sampleData,
        req.user!.organizationId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  activate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await this.service.activate(
        id!,
        req.user!.organizationId,
        req.user!.userId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  deactivate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await this.service.deactivate(
        id!,
        req.user!.organizationId,
        req.user!.userId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  createFromTemplate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { templateId } = req.params;
      const { customizations } = createFromTemplateSchema.parse(req.body);
      const result = await this.service.createFromTemplate(
        templateId!,
        req.user!.organizationId,
        customizations as Partial<MappingRules> | undefined,
        req.user!.userId
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  getLogs = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
      const result = await this.service.getExecutionLogs(
        id!,
        req.user!.organizationId,
        limit
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
