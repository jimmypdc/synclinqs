import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { MappingValidationService } from '../../services/mapping-validation.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { CreateValidationRuleData, UpdateValidationRuleData, RuleLogic } from '../../types/mapping.types.js';

const listRulesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  ruleType: z.enum(['IRS_LIMIT', 'FORMAT', 'BUSINESS_LOGIC', 'REQUIRED_FIELD', 'RANGE', 'PATTERN']).optional(),
  appliesTo: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

const createRuleSchema = z.object({
  name: z.string().min(1).max(255),
  ruleType: z.enum(['IRS_LIMIT', 'FORMAT', 'BUSINESS_LOGIC', 'REQUIRED_FIELD', 'RANGE', 'PATTERN']),
  appliesTo: z.string().min(1).max(100),
  ruleLogic: z.record(z.unknown()),
  errorMessage: z.string().min(1),
  severity: z.enum(['ERROR', 'WARNING', 'INFO']).default('ERROR'),
  isActive: z.boolean().default(true),
});

const updateRuleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  ruleLogic: z.record(z.unknown()).optional(),
  errorMessage: z.string().min(1).optional(),
  severity: z.enum(['ERROR', 'WARNING', 'INFO']).optional(),
  isActive: z.boolean().optional(),
});

const validateDataSchema = z.object({
  data: z.array(z.record(z.unknown())).min(1).max(1000),
  mappingType: z.enum(['CONTRIBUTION', 'EMPLOYEE', 'ELECTION', 'LOAN']),
});

export class ValidationRulesController {
  private service = new MappingValidationService();

  list = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = listRulesQuerySchema.parse(req.query);
      const result = await this.service.getValidationRules(query, req.user!.organizationId);
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
      const result = await this.service.getRuleById(id!);
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
      const parsed = createRuleSchema.parse(req.body);
      const data: CreateValidationRuleData = {
        ...parsed,
        ruleLogic: parsed.ruleLogic as unknown as RuleLogic,
      };
      const result = await this.service.createRule(
        data,
        req.user!.organizationId,
        req.user!.userId
      );
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
      const parsed = updateRuleSchema.parse(req.body);
      const data: UpdateValidationRuleData = {
        ...parsed,
        ruleLogic: parsed.ruleLogic as RuleLogic | undefined,
      };
      const result = await this.service.updateRule(id!, data, req.user!.userId);
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
      await this.service.deleteRule(id!, req.user!.userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  validate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { data, mappingType } = validateDataSchema.parse(req.body);
      const result = await this.service.validateMappedData(
        data,
        mappingType,
        req.user!.organizationId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
