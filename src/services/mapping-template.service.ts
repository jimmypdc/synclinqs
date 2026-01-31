import { prisma } from '../lib/prisma.js';
import { createError } from '../api/middleware/errorHandler.js';
import { MappingType } from '@prisma/client';
import { MappingRules, CreateTemplateData, UpdateTemplateData } from '../types/mapping.types.js';
import { cache, CACHE_TTL, CACHE_PREFIX, cacheKey } from '../lib/cache.js';

interface ListTemplatesQuery {
  sourceSystem?: string;
  destinationSystem?: string;
  mappingType?: MappingType;
  isVerified?: boolean;
}

export interface FormattedMappingTemplate {
  id: string;
  name: string;
  description?: string;
  sourceSystem: string;
  destinationSystem: string;
  mappingType: MappingType;
  templateRules: MappingRules;
  usageCount: number;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class MappingTemplateService {
  /**
   * List available templates with optional filtering
   */
  async list(query: ListTemplatesQuery = {}): Promise<FormattedMappingTemplate[]> {
    const where: Record<string, unknown> = {};

    if (query.sourceSystem) where.sourceSystem = query.sourceSystem;
    if (query.destinationSystem) where.destinationSystem = query.destinationSystem;
    if (query.mappingType) where.mappingType = query.mappingType;
    if (query.isVerified !== undefined) where.isVerified = query.isVerified;

    const templates = await prisma.mappingTemplate.findMany({
      where,
      orderBy: [{ isVerified: 'desc' }, { usageCount: 'desc' }, { name: 'asc' }],
    });

    return templates.map(this.formatTemplate);
  }

  /**
   * Get template by ID
   */
  async getById(id: string): Promise<FormattedMappingTemplate> {
    const key = cacheKey(CACHE_PREFIX.TEMPLATES, 'id', id);

    const cached = await cache.get<FormattedMappingTemplate>(key);
    if (cached) {
      return cached;
    }

    const template = await prisma.mappingTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw createError('Mapping template not found', 404, 'NOT_FOUND');
    }

    const formatted = this.formatTemplate(template);
    await cache.set(key, formatted, CACHE_TTL.MAPPING_TEMPLATES);

    return formatted;
  }

  /**
   * Get template by source, destination, and type
   */
  async getBySystemsAndType(
    sourceSystem: string,
    destinationSystem: string,
    mappingType: MappingType
  ): Promise<FormattedMappingTemplate | null> {
    const template = await prisma.mappingTemplate.findUnique({
      where: {
        sourceSystem_destinationSystem_mappingType: {
          sourceSystem,
          destinationSystem,
          mappingType,
        },
      },
    });

    return template ? this.formatTemplate(template) : null;
  }

  /**
   * Increment usage count when template is used
   */
  async incrementUsage(id: string): Promise<void> {
    await prisma.mappingTemplate.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
      },
    });
  }

  /**
   * Create a new template (admin only)
   */
  async create(data: CreateTemplateData): Promise<FormattedMappingTemplate> {
    // Check for duplicate
    const existing = await prisma.mappingTemplate.findUnique({
      where: {
        sourceSystem_destinationSystem_mappingType: {
          sourceSystem: data.sourceSystem,
          destinationSystem: data.destinationSystem,
          mappingType: data.mappingType,
        },
      },
    });

    if (existing) {
      throw createError(
        `Template for ${data.sourceSystem} → ${data.destinationSystem} (${data.mappingType}) already exists`,
        409,
        'DUPLICATE'
      );
    }

    const template = await prisma.mappingTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        sourceSystem: data.sourceSystem,
        destinationSystem: data.destinationSystem,
        mappingType: data.mappingType,
        templateRules: data.templateRules as object,
      },
    });

    // Invalidate cache
    await this.invalidateCache();

    return this.formatTemplate(template);
  }

  /**
   * Update a template (admin only)
   */
  async update(id: string, data: UpdateTemplateData): Promise<FormattedMappingTemplate> {
    const existing = await prisma.mappingTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError('Mapping template not found', 404, 'NOT_FOUND');
    }

    const template = await prisma.mappingTemplate.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        templateRules: data.templateRules as object | undefined,
        isVerified: data.isVerified,
      },
    });

    // Invalidate cache
    await this.invalidateCache(id);

    return this.formatTemplate(template);
  }

  /**
   * Mark template as verified (admin only)
   */
  async verify(id: string): Promise<FormattedMappingTemplate> {
    const existing = await prisma.mappingTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError('Mapping template not found', 404, 'NOT_FOUND');
    }

    const template = await prisma.mappingTemplate.update({
      where: { id },
      data: { isVerified: true },
    });

    // Invalidate cache (popular list may change)
    await this.invalidateCache(id);

    return this.formatTemplate(template);
  }

  /**
   * Unverify template (admin only)
   */
  async unverify(id: string): Promise<FormattedMappingTemplate> {
    const template = await prisma.mappingTemplate.update({
      where: { id },
      data: { isVerified: false },
    });

    // Invalidate cache
    await this.invalidateCache(id);

    return this.formatTemplate(template);
  }

  /**
   * Delete a template (admin only)
   */
  async delete(id: string): Promise<void> {
    const existing = await prisma.mappingTemplate.findUnique({
      where: { id },
      include: { mappingConfigurations: { select: { id: true }, take: 1 } },
    });

    if (!existing) {
      throw createError('Mapping template not found', 404, 'NOT_FOUND');
    }

    if (existing.mappingConfigurations.length > 0) {
      throw createError(
        'Cannot delete template that is used by mapping configurations',
        400,
        'TEMPLATE_IN_USE'
      );
    }

    await prisma.mappingTemplate.delete({
      where: { id },
    });

    // Invalidate cache
    await this.invalidateCache(id);
  }

  /**
   * Invalidate template cache
   */
  private async invalidateCache(templateId?: string): Promise<void> {
    // Invalidate popular templates cache
    await cache.deletePattern(`${CACHE_PREFIX.TEMPLATES}:popular:*`);

    // Invalidate specific template if provided
    if (templateId) {
      await cache.delete(cacheKey(CACHE_PREFIX.TEMPLATES, 'id', templateId));
    }
  }

  /**
   * Get popular templates
   */
  async getPopular(limit: number = 10): Promise<FormattedMappingTemplate[]> {
    const key = cacheKey(CACHE_PREFIX.TEMPLATES, 'popular', limit);

    return cache.wrap(
      key,
      async () => {
        const templates = await prisma.mappingTemplate.findMany({
          where: { isVerified: true },
          orderBy: { usageCount: 'desc' },
          take: limit,
        });
        return templates.map(this.formatTemplate);
      },
      CACHE_TTL.MAPPING_TEMPLATES
    );
  }

  /**
   * Format template for response
   */
  private formatTemplate(template: {
    id: string;
    name: string;
    description: string | null;
    sourceSystem: string;
    destinationSystem: string;
    mappingType: MappingType;
    templateRules: unknown;
    usageCount: number;
    isVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): FormattedMappingTemplate {
    return {
      id: template.id,
      name: template.name,
      description: template.description ?? undefined,
      sourceSystem: template.sourceSystem,
      destinationSystem: template.destinationSystem,
      mappingType: template.mappingType,
      templateRules: template.templateRules as MappingRules,
      usageCount: template.usageCount,
      isVerified: template.isVerified,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}
