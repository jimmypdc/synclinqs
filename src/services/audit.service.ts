import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../utils/logger.js';

interface AuditLogParams {
  organizationId?: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export class AuditService {
  async log(params: AuditLogParams): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          organizationId: params.organizationId,
          userId: params.userId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          oldValues: params.oldValues as Prisma.InputJsonValue | undefined,
          newValues: params.newValues as Prisma.InputJsonValue | undefined,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          requestId: params.requestId,
        },
      });
    } catch (error) {
      // Log but don't fail the main operation
      logger.error('Failed to create audit log', { error, params });
    }
  }

  async getAuditTrail(
    entityType: string,
    entityId: string,
    options?: { limit?: number; offset?: number; organizationId?: string }
  ): Promise<{
    logs: Array<{
      id: string;
      organizationId: string | null;
      userId: string | null;
      action: string;
      oldValues: unknown;
      newValues: unknown;
      createdAt: Date;
    }>;
    total: number;
  }> {
    const where: Prisma.AuditLogWhereInput = {
      entityType,
      entityId,
    };

    // Filter by organization if provided
    if (options?.organizationId) {
      where.organizationId = options.organizationId;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
        select: {
          id: true,
          organizationId: true,
          userId: true,
          action: true,
          oldValues: true,
          newValues: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  async getOrganizationAuditLogs(
    organizationId: string,
    options?: {
      limit?: number;
      offset?: number;
      action?: string;
      entityType?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{
    logs: Array<{
      id: string;
      userId: string | null;
      action: string;
      entityType: string;
      entityId: string | null;
      newValues: unknown;
      createdAt: Date;
      user?: { email: string; firstName: string; lastName: string } | null;
    }>;
    total: number;
  }> {
    const where: Prisma.AuditLogWhereInput = {
      organizationId,
    };

    if (options?.action) {
      where.action = options.action;
    }
    if (options?.entityType) {
      where.entityType = options.entityType;
    }
    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
        select: {
          id: true,
          userId: true,
          action: true,
          entityType: true,
          entityId: true,
          newValues: true,
          createdAt: true,
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }
}
