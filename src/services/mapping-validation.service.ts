import { prisma } from '../lib/prisma.js';
import { createError } from '../api/middleware/errorHandler.js';
import { MappingType, ValidationRuleType, ValidationSeverity } from '@prisma/client';
import {
  CreateValidationRuleData,
  UpdateValidationRuleData,
  ListRulesQuery,
  ValidationError,
  ValidationResult,
  RuleLogic,
} from '../types/mapping.types.js';
import { AuditService } from './audit.service.js';

interface FormattedValidationRule {
  id: string;
  organizationId?: string;
  name: string;
  ruleType: ValidationRuleType;
  appliesTo: string;
  ruleLogic: RuleLogic;
  errorMessage: string;
  severity: ValidationSeverity;
  isActive: boolean;
  isGlobal: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class MappingValidationService {
  private auditService = new AuditService();

  /**
   * Validate mapped data against applicable rules
   */
  async validateMappedData(
    data: Record<string, unknown>[],
    mappingType: MappingType,
    organizationId: string
  ): Promise<ValidationResult[]> {
    // Get all applicable rules (global + organization-specific)
    const rules = await this.getApplicableRules(mappingType, organizationId);

    const results: ValidationResult[] = [];

    for (const record of data) {
      const errors: ValidationError[] = [];
      const warnings: ValidationError[] = [];

      for (const rule of rules) {
        const validationError = this.validateRecord(record, rule);

        if (validationError) {
          if (rule.severity === 'ERROR') {
            errors.push(validationError);
          } else {
            warnings.push(validationError);
          }
        }
      }

      results.push({
        valid: errors.length === 0,
        errors,
        warnings,
      });
    }

    return results;
  }

  /**
   * Validate a single record against a rule
   */
  private validateRecord(
    record: Record<string, unknown>,
    rule: FormattedValidationRule
  ): ValidationError | null {
    const fieldValue = record[rule.appliesTo];
    const logic = rule.ruleLogic;

    let isValid = true;

    switch (logic.operator) {
      case 'equals':
        isValid = fieldValue === logic.value;
        break;
      case 'not_equals':
        isValid = fieldValue !== logic.value;
        break;
      case 'greater_than':
        isValid = Number(fieldValue) > Number(logic.value);
        break;
      case 'less_than':
        isValid = Number(fieldValue) < Number(logic.value);
        break;
      case 'between':
        isValid =
          Number(fieldValue) >= Number(logic.min) &&
          Number(fieldValue) <= Number(logic.max);
        break;
      case 'in':
        isValid = Array.isArray(logic.values) && logic.values.includes(fieldValue);
        break;
      case 'not_in':
        isValid = !Array.isArray(logic.values) || !logic.values.includes(fieldValue);
        break;
      case 'matches':
        if (logic.pattern && fieldValue !== null && fieldValue !== undefined) {
          try {
            const regex = new RegExp(logic.pattern);
            isValid = regex.test(String(fieldValue));
          } catch {
            isValid = false;
          }
        } else {
          isValid = false;
        }
        break;
      case 'not_empty':
        isValid =
          fieldValue !== null &&
          fieldValue !== undefined &&
          (typeof fieldValue !== 'string' || fieldValue.trim() !== '');
        break;
      default:
        isValid = true;
    }

    if (!isValid) {
      return {
        field: rule.appliesTo,
        code: rule.ruleType,
        message: rule.errorMessage,
        value: fieldValue,
        severity: rule.severity,
      };
    }

    return null;
  }

  /**
   * Get all rules applicable to a mapping type
   */
  private async getApplicableRules(
    mappingType: MappingType,
    organizationId: string
  ): Promise<FormattedValidationRule[]> {
    // Get global rules (organizationId is null)
    const globalRules = await prisma.validationRule.findMany({
      where: {
        organizationId: null,
        isActive: true,
        // appliesTo should match the mapping type or be universal
        OR: [
          { appliesTo: mappingType },
          { appliesTo: 'ALL' },
        ],
      },
    });

    // Get organization-specific rules
    const orgRules = await prisma.validationRule.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: [
          { appliesTo: mappingType },
          { appliesTo: 'ALL' },
        ],
      },
    });

    return [
      ...globalRules.map((r) => this.formatRule(r, true)),
      ...orgRules.map((r) => this.formatRule(r, false)),
    ];
  }

  /**
   * Get validation rules with optional filtering
   */
  async getValidationRules(
    query: ListRulesQuery,
    organizationId?: string
  ): Promise<{ data: FormattedValidationRule[]; pagination: Pagination }> {
    const where: Record<string, unknown> = {};

    // For org-specific queries, include both global and org rules
    if (organizationId) {
      where.OR = [{ organizationId: null }, { organizationId }];
    }

    if (query.ruleType) where.ruleType = query.ruleType;
    if (query.appliesTo) where.appliesTo = query.appliesTo;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [rules, total] = await Promise.all([
      prisma.validationRule.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ organizationId: 'asc' }, { name: 'asc' }],
      }),
      prisma.validationRule.count({ where }),
    ]);

    return {
      data: rules.map((r) => this.formatRule(r, r.organizationId === null)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * Get a single validation rule
   */
  async getRuleById(id: string): Promise<FormattedValidationRule> {
    const rule = await prisma.validationRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw createError('Validation rule not found', 404, 'NOT_FOUND');
    }

    return this.formatRule(rule, rule.organizationId === null);
  }

  /**
   * Create a validation rule
   */
  async createRule(
    data: CreateValidationRuleData,
    organizationId: string | null,
    userId: string
  ): Promise<FormattedValidationRule> {
    const rule = await prisma.validationRule.create({
      data: {
        organizationId,
        name: data.name,
        ruleType: data.ruleType,
        appliesTo: data.appliesTo,
        ruleLogic: data.ruleLogic as object,
        errorMessage: data.errorMessage,
        severity: data.severity ?? 'ERROR',
        isActive: data.isActive ?? true,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entityType: 'ValidationRule',
      entityId: rule.id,
      newValues: { name: data.name, ruleType: data.ruleType, appliesTo: data.appliesTo },
    });

    return this.formatRule(rule, rule.organizationId === null);
  }

  /**
   * Update a validation rule
   */
  async updateRule(
    id: string,
    data: UpdateValidationRuleData,
    userId: string
  ): Promise<FormattedValidationRule> {
    const existing = await prisma.validationRule.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError('Validation rule not found', 404, 'NOT_FOUND');
    }

    const rule = await prisma.validationRule.update({
      where: { id },
      data: {
        name: data.name,
        ruleLogic: data.ruleLogic as object | undefined,
        errorMessage: data.errorMessage,
        severity: data.severity,
        isActive: data.isActive,
      },
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entityType: 'ValidationRule',
      entityId: id,
      oldValues: { name: existing.name, isActive: existing.isActive },
      newValues: { name: data.name, isActive: data.isActive },
    });

    return this.formatRule(rule, rule.organizationId === null);
  }

  /**
   * Delete a validation rule
   */
  async deleteRule(id: string, userId: string): Promise<void> {
    const existing = await prisma.validationRule.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError('Validation rule not found', 404, 'NOT_FOUND');
    }

    await prisma.validationRule.delete({
      where: { id },
    });

    await this.auditService.log({
      userId,
      action: 'DELETE',
      entityType: 'ValidationRule',
      entityId: id,
    });
  }

  /**
   * Format validation rule for response
   */
  private formatRule(
    rule: {
      id: string;
      organizationId: string | null;
      name: string;
      ruleType: ValidationRuleType;
      appliesTo: string;
      ruleLogic: unknown;
      errorMessage: string;
      severity: ValidationSeverity;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    },
    isGlobal: boolean
  ): FormattedValidationRule {
    return {
      id: rule.id,
      organizationId: rule.organizationId ?? undefined,
      name: rule.name,
      ruleType: rule.ruleType,
      appliesTo: rule.appliesTo,
      ruleLogic: rule.ruleLogic as RuleLogic,
      errorMessage: rule.errorMessage,
      severity: rule.severity,
      isActive: rule.isActive,
      isGlobal,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
