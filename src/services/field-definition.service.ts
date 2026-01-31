import { prisma } from '../lib/prisma.js';
import { createError } from '../api/middleware/errorHandler.js';
import { FieldDataType, Prisma } from '@prisma/client';
import {
  CreateFieldDefinitionData,
  UpdateFieldDefinitionData,
} from '../types/mapping.types.js';
import { cache, CACHE_TTL, CACHE_PREFIX, cacheKey } from '../lib/cache.js';

interface ListFieldsQuery {
  systemName?: string;
  isPii?: boolean;
  isRequired?: boolean;
}

export class FieldDefinitionService {
  /**
   * Get all unique system names
   */
  async getSystems(): Promise<string[]> {
    const key = cacheKey(CACHE_PREFIX.FIELDS, 'systems');

    return cache.wrap(
      key,
      async () => {
        const systems = await prisma.fieldDefinition.findMany({
          select: { systemName: true },
          distinct: ['systemName'],
          orderBy: { systemName: 'asc' },
        });
        return systems.map((s) => s.systemName);
      },
      CACHE_TTL.FIELD_DEFINITIONS
    );
  }

  /**
   * Get field definitions for a specific system
   */
  async getFieldsForSystem(systemName: string): Promise<FormattedFieldDefinition[]> {
    const key = cacheKey(CACHE_PREFIX.FIELDS, 'system', systemName);

    return cache.wrap(
      key,
      async () => {
        const fields = await prisma.fieldDefinition.findMany({
          where: { systemName },
          orderBy: { fieldName: 'asc' },
        });
        return fields.map(this.formatFieldDefinition);
      },
      CACHE_TTL.FIELD_DEFINITIONS
    );
  }

  /**
   * List all field definitions with optional filtering
   */
  async list(query: ListFieldsQuery = {}): Promise<FormattedFieldDefinition[]> {
    const where: Record<string, unknown> = {};

    if (query.systemName) where.systemName = query.systemName;
    if (query.isPii !== undefined) where.isPii = query.isPii;
    if (query.isRequired !== undefined) where.isRequired = query.isRequired;

    const fields = await prisma.fieldDefinition.findMany({
      where,
      orderBy: [{ systemName: 'asc' }, { fieldName: 'asc' }],
    });

    return fields.map(this.formatFieldDefinition);
  }

  /**
   * Get a single field definition by ID
   */
  async getById(id: string): Promise<FormattedFieldDefinition> {
    const field = await prisma.fieldDefinition.findUnique({
      where: { id },
    });

    if (!field) {
      throw createError('Field definition not found', 404, 'NOT_FOUND');
    }

    return this.formatFieldDefinition(field);
  }

  /**
   * Get a field by system and field name
   */
  async getBySystemAndName(
    systemName: string,
    fieldName: string
  ): Promise<FormattedFieldDefinition | null> {
    const field = await prisma.fieldDefinition.findUnique({
      where: {
        systemName_fieldName: { systemName, fieldName },
      },
    });

    return field ? this.formatFieldDefinition(field) : null;
  }

  /**
   * Create a new field definition
   */
  async create(data: CreateFieldDefinitionData): Promise<FormattedFieldDefinition> {
    // Check for duplicate
    const existing = await prisma.fieldDefinition.findUnique({
      where: {
        systemName_fieldName: {
          systemName: data.systemName,
          fieldName: data.fieldName,
        },
      },
    });

    if (existing) {
      throw createError(
        `Field ${data.fieldName} already exists for system ${data.systemName}`,
        409,
        'DUPLICATE'
      );
    }

    const field = await prisma.fieldDefinition.create({
      data: {
        systemName: data.systemName,
        fieldName: data.fieldName,
        displayName: data.displayName,
        dataType: data.dataType,
        formatPattern: data.formatPattern,
        isRequired: data.isRequired ?? false,
        isPii: data.isPii ?? false,
        validationRules: (data.validationRules ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        description: data.description,
        exampleValue: data.exampleValue,
      },
    });

    // Invalidate cache
    await this.invalidateCache(data.systemName);

    return this.formatFieldDefinition(field);
  }

  /**
   * Update a field definition
   */
  async update(id: string, data: UpdateFieldDefinitionData): Promise<FormattedFieldDefinition> {
    const existing = await prisma.fieldDefinition.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError('Field definition not found', 404, 'NOT_FOUND');
    }

    const field = await prisma.fieldDefinition.update({
      where: { id },
      data: {
        displayName: data.displayName,
        formatPattern: data.formatPattern,
        isRequired: data.isRequired,
        isPii: data.isPii,
        validationRules: data.validationRules as Prisma.InputJsonValue | undefined,
        description: data.description,
        exampleValue: data.exampleValue,
      },
    });

    // Invalidate cache
    await this.invalidateCache(existing.systemName);

    return this.formatFieldDefinition(field);
  }

  /**
   * Delete a field definition
   */
  async delete(id: string): Promise<void> {
    const existing = await prisma.fieldDefinition.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError('Field definition not found', 404, 'NOT_FOUND');
    }

    await prisma.fieldDefinition.delete({
      where: { id },
    });

    // Invalidate cache
    await this.invalidateCache(existing.systemName);
  }

  /**
   * Bulk import field definitions for a system
   */
  async bulkImport(
    systemName: string,
    fields: CreateFieldDefinitionData[]
  ): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const fieldData of fields) {
      const existing = await prisma.fieldDefinition.findUnique({
        where: {
          systemName_fieldName: {
            systemName,
            fieldName: fieldData.fieldName,
          },
        },
      });

      if (existing) {
        await prisma.fieldDefinition.update({
          where: { id: existing.id },
          data: {
            displayName: fieldData.displayName,
            dataType: fieldData.dataType,
            formatPattern: fieldData.formatPattern,
            isRequired: fieldData.isRequired ?? false,
            isPii: fieldData.isPii ?? false,
            validationRules: (fieldData.validationRules ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            description: fieldData.description,
            exampleValue: fieldData.exampleValue,
          },
        });
        updated++;
      } else {
        await prisma.fieldDefinition.create({
          data: {
            systemName,
            fieldName: fieldData.fieldName,
            displayName: fieldData.displayName,
            dataType: fieldData.dataType,
            formatPattern: fieldData.formatPattern,
            isRequired: fieldData.isRequired ?? false,
            isPii: fieldData.isPii ?? false,
            validationRules: (fieldData.validationRules ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            description: fieldData.description,
            exampleValue: fieldData.exampleValue,
          },
        });
        created++;
      }
    }

    // Invalidate cache for this system
    await this.invalidateCache(systemName);

    return { created, updated };
  }

  /**
   * Invalidate cache for field definitions
   */
  private async invalidateCache(systemName?: string): Promise<void> {
    // Always invalidate the systems list
    await cache.delete(cacheKey(CACHE_PREFIX.FIELDS, 'systems'));

    // Invalidate specific system cache if provided
    if (systemName) {
      await cache.delete(cacheKey(CACHE_PREFIX.FIELDS, 'system', systemName));
    }
  }

  /**
   * Format field definition for response
   */
  private formatFieldDefinition(field: {
    id: string;
    systemName: string;
    fieldName: string;
    displayName: string;
    dataType: FieldDataType;
    formatPattern: string | null;
    isRequired: boolean;
    isPii: boolean;
    validationRules: unknown;
    description: string | null;
    exampleValue: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): FormattedFieldDefinition {
    return {
      id: field.id,
      systemName: field.systemName,
      fieldName: field.fieldName,
      displayName: field.displayName,
      dataType: field.dataType,
      formatPattern: field.formatPattern ?? undefined,
      isRequired: field.isRequired,
      isPii: field.isPii,
      validationRules: field.validationRules as Record<string, unknown> | undefined,
      description: field.description ?? undefined,
      exampleValue: field.exampleValue ?? undefined,
      createdAt: field.createdAt,
      updatedAt: field.updatedAt,
    };
  }
}

export interface FormattedFieldDefinition {
  id: string;
  systemName: string;
  fieldName: string;
  displayName: string;
  dataType: FieldDataType;
  formatPattern?: string;
  isRequired: boolean;
  isPii: boolean;
  validationRules?: Record<string, unknown>;
  description?: string;
  exampleValue?: string;
  createdAt: Date;
  updatedAt: Date;
}
