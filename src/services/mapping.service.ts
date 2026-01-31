import { prisma } from '../lib/prisma.js';
import { createError } from '../api/middleware/errorHandler.js';
import { MappingType, Prisma } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { AuditService } from './audit.service.js';
import { MappingTemplateService } from './mapping-template.service.js';
import { MappingValidationService } from './mapping-validation.service.js';
import { TransformationService } from '../transformations/index.js';
import {
  MappingRules,
  MappingResult,
  MappingError,
  MappingWarning,
  MappingMetrics,
  CreateMappingData,
  UpdateMappingData,
  ListMappingsQuery,
  FormattedMapping,
  FieldMapping,
  ConditionalMapping,
  CalculatedField,
  LookupMapping,
  DefaultValue,
} from '../types/mapping.types.js';

interface ApplyMappingOptions {
  dryRun?: boolean;
  batchSize?: number;
  skipValidation?: boolean;
}

interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class MappingService {
  private auditService = new AuditService();
  private templateService = new MappingTemplateService();
  private validationService = new MappingValidationService();
  private transformationService = new TransformationService();

  // ============================================
  // Core Mapping Methods
  // ============================================

  /**
   * Apply mapping configuration to source data
   */
  async applyMapping(
    mappingConfigId: string,
    sourceData: Record<string, unknown>[],
    organizationId: string,
    options: ApplyMappingOptions = {}
  ): Promise<MappingResult> {
    const startTime = Date.now();

    // Load mapping configuration
    const config = await prisma.mappingConfiguration.findFirst({
      where: {
        id: mappingConfigId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!config) {
      throw createError('Mapping configuration not found', 404, 'NOT_FOUND');
    }

    if (!config.isActive && !options.dryRun) {
      throw createError('Mapping configuration is not active', 400, 'MAPPING_INACTIVE');
    }

    const rules = config.mappingRules as unknown as MappingRules;
    const results: Record<string, unknown>[] = [];
    const errors: MappingError[] = [];
    const warnings: MappingWarning[] = [];

    // Process each record
    for (let i = 0; i < sourceData.length; i++) {
      try {
        const record = sourceData[i];
        if (!record) continue;
        const mappedRecord = await this.applyMappingRules(record, rules, i);
        results.push(mappedRecord);
      } catch (error) {
        errors.push({
          recordIndex: i,
          code: 'MAPPING_FAILED',
          message: error instanceof Error ? error.message : 'Unknown mapping error',
        });
      }
    }

    // Validate mapped data if not skipped
    if (!options.skipValidation && results.length > 0) {
      const validationResults = await this.validationService.validateMappedData(
        results,
        config.mappingType,
        organizationId
      );

      validationResults.forEach((result, index) => {
        errors.push(
          ...result.errors.map((e) => ({
            recordIndex: index,
            field: e.field,
            code: e.code,
            message: e.message,
            sourceValue: e.value,
          }))
        );
        warnings.push(
          ...result.warnings.map((w) => ({
            recordIndex: index,
            field: w.field,
            code: w.code,
            message: w.message,
          }))
        );
      });
    }

    const endTime = Date.now();
    const processingTimeMs = endTime - startTime;

    const metrics: MappingMetrics = {
      totalRecords: sourceData.length,
      successfulRecords: results.length,
      failedRecords: errors.filter((e) => e.code === 'MAPPING_FAILED').length,
      processingTimeMs,
      avgTimePerRecordMs:
        sourceData.length > 0 ? processingTimeMs / sourceData.length : 0,
    };

    // Log execution if not dry run
    if (!options.dryRun) {
      await this.logExecution(mappingConfigId, metrics, errors, null);
    }

    return {
      success: errors.filter((e) => e.code !== 'VALIDATION_WARNING').length === 0,
      data: results,
      errors,
      warnings,
      metrics,
    };
  }

  /**
   * Test mapping with sample data (dry run)
   */
  async testMapping(
    mappingConfigId: string,
    sampleData: Record<string, unknown>[],
    organizationId: string
  ): Promise<MappingResult> {
    return this.applyMapping(mappingConfigId, sampleData, organizationId, {
      dryRun: true,
    });
  }

  /**
   * Apply mapping rules to a single record
   */
  private async applyMappingRules(
    source: Record<string, unknown>,
    rules: MappingRules,
    recordIndex: number
  ): Promise<Record<string, unknown>> {
    let result: Record<string, unknown> = {};

    // 1. Apply field mappings
    result = this.applyFieldMappings(source, rules.fieldMappings);

    // 2. Apply conditional mappings
    if (rules.conditionalMappings) {
      result = this.applyConditionalMappings(source, result, rules.conditionalMappings);
    }

    // 3. Apply calculated fields
    if (rules.calculatedFields) {
      result = this.applyCalculatedFields(source, result, rules.calculatedFields);
    }

    // 4. Apply lookup mappings
    if (rules.lookupMappings) {
      result = await this.applyLookupMappings(source, result, rules.lookupMappings);
    }

    // 5. Apply default values
    if (rules.defaultValues) {
      result = this.applyDefaultValues(result, rules.defaultValues);
    }

    return result;
  }

  /**
   * Apply field mappings with transformations
   */
  private applyFieldMappings(
    source: Record<string, unknown>,
    fieldMappings: FieldMapping[]
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const mapping of fieldMappings) {
      let value = source[mapping.sourceField];

      // Apply transformation if specified
      if (mapping.transformation && value !== null && value !== undefined) {
        try {
          value = this.transformationService.transform(
            mapping.transformation,
            value,
            mapping.transformationParams
          );
        } catch (error) {
          logger.warn('Transformation failed', {
            field: mapping.sourceField,
            transformation: mapping.transformation,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          // Keep original value if transformation fails
        }
      }

      result[mapping.destinationField] = value;
    }

    return result;
  }

  /**
   * Apply conditional mappings based on source values
   */
  private applyConditionalMappings(
    source: Record<string, unknown>,
    result: Record<string, unknown>,
    conditionalMappings: ConditionalMapping[]
  ): Record<string, unknown> {
    for (const conditional of conditionalMappings) {
      // Simple condition evaluation
      // Format: "field === 'value'" or "field !== 'value'"
      const conditionMet = this.evaluateCondition(source, conditional.condition);

      if (conditionMet) {
        for (const mapping of conditional.mappings) {
          result[mapping.destinationField] = mapping.value;
        }
      }
    }

    return result;
  }

  /**
   * Evaluate a simple condition expression
   */
  private evaluateCondition(
    source: Record<string, unknown>,
    condition: string
  ): boolean {
    try {
      // Parse condition: "source.field === 'value'" or "source.field !== 'value'"
      const equalsMatch = condition.match(
        /source\.(\w+)\s*===?\s*['"]?([^'"]+)['"]?/
      );
      const notEqualsMatch = condition.match(
        /source\.(\w+)\s*!==?\s*['"]?([^'"]+)['"]?/
      );

      if (equalsMatch && equalsMatch[1] && equalsMatch[2]) {
        const field = equalsMatch[1];
        const value = equalsMatch[2];
        return String(source[field]) === value;
      }

      if (notEqualsMatch && notEqualsMatch[1] && notEqualsMatch[2]) {
        const field = notEqualsMatch[1];
        const value = notEqualsMatch[2];
        return String(source[field]) !== value;
      }

      // Greater than
      const gtMatch = condition.match(/source\.(\w+)\s*>\s*(\d+)/);
      if (gtMatch && gtMatch[1] && gtMatch[2]) {
        const field = gtMatch[1];
        const value = gtMatch[2];
        return Number(source[field]) > Number(value);
      }

      // Less than
      const ltMatch = condition.match(/source\.(\w+)\s*<\s*(\d+)/);
      if (ltMatch && ltMatch[1] && ltMatch[2]) {
        const field = ltMatch[1];
        const value = ltMatch[2];
        return Number(source[field]) < Number(value);
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Apply calculated fields
   */
  private applyCalculatedFields(
    source: Record<string, unknown>,
    result: Record<string, unknown>,
    calculatedFields: CalculatedField[]
  ): Record<string, unknown> {
    for (const calc of calculatedFields) {
      try {
        // Simple formula evaluation: "source.field1 * source.field2"
        let value = this.evaluateFormula(source, calc.formula);

        // Apply rounding
        if (typeof value === 'number' && calc.rounding) {
          if (calc.rounding === 'cents') {
            value = Math.round(value * 100) / 100;
          } else if (calc.rounding === 'dollars') {
            value = Math.round(value);
          }
        }

        result[calc.destinationField] = value;
      } catch (error) {
        logger.warn('Calculated field failed', {
          field: calc.destinationField,
          formula: calc.formula,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Evaluate a simple formula
   */
  private evaluateFormula(
    source: Record<string, unknown>,
    formula: string
  ): number {
    // Replace source.field references with actual values
    let expression = formula;
    const fieldRefs = formula.match(/source\.(\w+)/g) || [];

    for (const ref of fieldRefs) {
      const field = ref.replace('source.', '');
      const value = Number(source[field]) || 0;
      expression = expression.replace(ref, String(value));
    }

    // Safely evaluate arithmetic expression
    // Only allow: numbers, +, -, *, /, (, ), spaces
    if (!/^[\d\s+\-*/().]+$/.test(expression)) {
      throw new Error('Invalid formula expression');
    }

    // Use Function constructor for safe evaluation
    return new Function(`return ${expression}`)() as number;
  }

  /**
   * Apply lookup mappings
   */
  private async applyLookupMappings(
    source: Record<string, unknown>,
    result: Record<string, unknown>,
    lookupMappings: LookupMapping[]
  ): Promise<Record<string, unknown>> {
    for (const lookup of lookupMappings) {
      const sourceValue = source[lookup.sourceField];

      if (sourceValue === null || sourceValue === undefined) {
        result[lookup.destinationField] = lookup.defaultValue ?? null;
        continue;
      }

      // If lookup table is an object (inline map)
      if (typeof lookup.lookupTable === 'object') {
        const lookupResult = (lookup.lookupTable as Record<string, unknown>)[
          String(sourceValue)
        ];
        result[lookup.destinationField] = lookupResult ?? lookup.defaultValue ?? null;
      } else {
        // External table lookup would go here
        // For now, just use default value
        result[lookup.destinationField] = lookup.defaultValue ?? sourceValue;
      }
    }

    return result;
  }

  /**
   * Apply default values
   */
  private applyDefaultValues(
    result: Record<string, unknown>,
    defaultValues: DefaultValue[]
  ): Record<string, unknown> {
    for (const def of defaultValues) {
      const currentValue = result[def.destinationField];

      switch (def.applyWhen) {
        case 'always':
          result[def.destinationField] = def.value;
          break;
        case 'if_null':
          if (currentValue === null || currentValue === undefined) {
            result[def.destinationField] = def.value;
          }
          break;
        case 'if_empty':
          if (
            currentValue === null ||
            currentValue === undefined ||
            currentValue === '' ||
            (Array.isArray(currentValue) && currentValue.length === 0)
          ) {
            result[def.destinationField] = def.value;
          }
          break;
      }
    }

    return result;
  }

  // ============================================
  // CRUD Operations
  // ============================================

  /**
   * Create a mapping configuration
   */
  async create(
    data: CreateMappingData,
    organizationId: string,
    userId: string
  ): Promise<FormattedMapping> {
    const config = await prisma.mappingConfiguration.create({
      data: {
        organizationId,
        name: data.name,
        sourceSystem: data.sourceSystem,
        destinationSystem: data.destinationSystem,
        mappingType: data.mappingType,
        mappingRules: data.mappingRules as object,
        templateId: data.templateId,
        createdBy: userId,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entityType: 'MappingConfiguration',
      entityId: config.id,
      newValues: {
        name: data.name,
        sourceSystem: data.sourceSystem,
        destinationSystem: data.destinationSystem,
        mappingType: data.mappingType,
      },
    });

    // Increment template usage if created from template
    if (data.templateId) {
      await this.templateService.incrementUsage(data.templateId);
    }

    return this.formatMapping(config);
  }

  /**
   * Create mapping from template
   */
  async createFromTemplate(
    templateId: string,
    organizationId: string,
    customizations: Partial<MappingRules> | undefined,
    userId: string
  ): Promise<FormattedMapping> {
    const template = await this.templateService.getById(templateId);

    // Merge template rules with customizations
    const mappingRules: MappingRules = {
      ...template.templateRules,
      ...customizations,
    };

    return this.create(
      {
        name: `${template.name} (from template)`,
        sourceSystem: template.sourceSystem,
        destinationSystem: template.destinationSystem,
        mappingType: template.mappingType,
        mappingRules,
        templateId,
      },
      organizationId,
      userId
    );
  }

  /**
   * List mapping configurations for organization
   */
  async list(
    query: ListMappingsQuery,
    organizationId: string
  ): Promise<PaginatedResult<FormattedMapping>> {
    const where: Record<string, unknown> = {
      organizationId,
      deletedAt: null,
    };

    if (query.sourceSystem) where.sourceSystem = query.sourceSystem;
    if (query.destinationSystem) where.destinationSystem = query.destinationSystem;
    if (query.mappingType) where.mappingType = query.mappingType;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [configs, total] = await Promise.all([
      prisma.mappingConfiguration.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
        include: {
          template: { select: { name: true, isVerified: true } },
        },
      }),
      prisma.mappingConfiguration.count({ where }),
    ]);

    return {
      data: configs.map(this.formatMapping),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * Get mapping configuration by ID
   */
  async getById(id: string, organizationId: string): Promise<FormattedMapping> {
    const config = await prisma.mappingConfiguration.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        template: { select: { name: true, isVerified: true } },
      },
    });

    if (!config) {
      throw createError('Mapping configuration not found', 404, 'NOT_FOUND');
    }

    return this.formatMapping(config);
  }

  /**
   * Update mapping configuration
   */
  async update(
    id: string,
    data: UpdateMappingData,
    organizationId: string,
    userId: string
  ): Promise<FormattedMapping> {
    const existing = await prisma.mappingConfiguration.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    if (!existing) {
      throw createError('Mapping configuration not found', 404, 'NOT_FOUND');
    }

    const config = await prisma.mappingConfiguration.update({
      where: { id },
      data: {
        name: data.name,
        mappingRules: data.mappingRules as object | undefined,
        isActive: data.isActive,
        version: { increment: 1 },
        updatedBy: userId,
      },
      include: {
        template: { select: { name: true, isVerified: true } },
      },
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entityType: 'MappingConfiguration',
      entityId: id,
      oldValues: { name: existing.name, isActive: existing.isActive },
      newValues: { name: data.name, isActive: data.isActive },
    });

    return this.formatMapping(config);
  }

  /**
   * Soft delete mapping configuration
   */
  async delete(id: string, organizationId: string, userId: string): Promise<void> {
    const existing = await prisma.mappingConfiguration.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    if (!existing) {
      throw createError('Mapping configuration not found', 404, 'NOT_FOUND');
    }

    await prisma.mappingConfiguration.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        updatedBy: userId,
      },
    });

    await this.auditService.log({
      userId,
      action: 'DELETE',
      entityType: 'MappingConfiguration',
      entityId: id,
    });
  }

  /**
   * Activate mapping configuration
   */
  async activate(id: string, organizationId: string, userId: string): Promise<FormattedMapping> {
    return this.update(id, { isActive: true }, organizationId, userId);
  }

  /**
   * Deactivate mapping configuration
   */
  async deactivate(id: string, organizationId: string, userId: string): Promise<FormattedMapping> {
    return this.update(id, { isActive: false }, organizationId, userId);
  }

  // ============================================
  // Execution Logs
  // ============================================

  /**
   * Log mapping execution
   */
  private async logExecution(
    mappingConfigId: string,
    metrics: MappingMetrics,
    errors: MappingError[],
    fileUploadId: string | null
  ): Promise<void> {
    const errorSummary: Record<string, number> = {};
    for (const error of errors) {
      errorSummary[error.code] = (errorSummary[error.code] || 0) + 1;
    }

    await prisma.mappingExecutionLog.create({
      data: {
        mappingConfigId,
        fileUploadId,
        executionStart: new Date(Date.now() - metrics.processingTimeMs),
        executionEnd: new Date(),
        recordsProcessed: metrics.totalRecords,
        recordsSuccessful: metrics.successfulRecords,
        recordsFailed: metrics.failedRecords,
        errorSummary: errorSummary as Prisma.InputJsonValue,
        sampleErrors: errors.slice(0, 10) as unknown as Prisma.InputJsonValue,
        performanceMetrics: {
          avgTimePerRecordMs: metrics.avgTimePerRecordMs,
          totalTimeMs: metrics.processingTimeMs,
        },
      },
    });
  }

  /**
   * Get execution logs for a mapping configuration
   */
  async getExecutionLogs(
    mappingConfigId: string,
    organizationId: string,
    limit: number = 20
  ): Promise<ExecutionLogSummary[]> {
    // Verify ownership
    const config = await prisma.mappingConfiguration.findFirst({
      where: { id: mappingConfigId, organizationId, deletedAt: null },
    });

    if (!config) {
      throw createError('Mapping configuration not found', 404, 'NOT_FOUND');
    }

    const logs = await prisma.mappingExecutionLog.findMany({
      where: { mappingConfigId },
      orderBy: { executionStart: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      executionStart: log.executionStart,
      executionEnd: log.executionEnd ?? undefined,
      recordsProcessed: log.recordsProcessed,
      recordsSuccessful: log.recordsSuccessful,
      recordsFailed: log.recordsFailed,
      status: log.executionEnd
        ? log.recordsFailed === 0
          ? 'completed'
          : 'completed_with_errors'
        : 'running',
    }));
  }

  // ============================================
  // Helpers
  // ============================================

  /**
   * Format mapping configuration for response
   */
  private formatMapping(config: {
    id: string;
    name: string;
    sourceSystem: string;
    destinationSystem: string;
    mappingType: MappingType;
    mappingRules: unknown;
    isActive: boolean;
    templateId: string | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string | null;
    template?: { name: string; isVerified: boolean } | null;
  }): FormattedMapping {
    return {
      id: config.id,
      name: config.name,
      sourceSystem: config.sourceSystem,
      destinationSystem: config.destinationSystem,
      mappingType: config.mappingType,
      mappingRules: config.mappingRules as MappingRules,
      isActive: config.isActive,
      templateId: config.templateId ?? undefined,
      version: config.version,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      createdBy: config.createdBy ?? undefined,
    };
  }
}

interface ExecutionLogSummary {
  id: string;
  executionStart: Date;
  executionEnd?: Date;
  recordsProcessed: number;
  recordsSuccessful: number;
  recordsFailed: number;
  status: 'running' | 'completed' | 'completed_with_errors';
}
