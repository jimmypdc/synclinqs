import { prisma } from '../lib/prisma.js';
import { logger } from '../utils/logger.js';

interface AuditLogParams {
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
          userId: params.userId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          oldValues: params.oldValues,
          newValues: params.newValues,
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
    options?: { limit?: number; offset?: number }
  ): Promise<{
    logs: Array<{
      id: string;
      userId: string | null;
      action: string;
      oldValues: unknown;
      newValues: unknown;
      createdAt: Date;
    }>;
    total: number;
  }> {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { entityType, entityId },
        orderBy: { createdAt: 'desc' },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
        select: {
          id: true,
          userId: true,
          action: true,
          oldValues: true,
          newValues: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.count({
        where: { entityType, entityId },
      }),
    ]);

    return { logs, total };
  }
}
