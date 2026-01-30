import { prisma } from '../lib/prisma.js';
import { createError } from '../api/middleware/errorHandler.js';
import { AuditService } from './audit.service.js';

interface CreateContributionData {
  employeeId: string;
  planId: string;
  payrollDate: string;
  employeePreTax: number;
  employeeRoth?: number;
  employerMatch?: number;
  employerNonMatch?: number;
  loanRepayment?: number;
  idempotencyKey?: string;
}

interface UpdateContributionData {
  employeePreTax?: number;
  employeeRoth?: number;
  employerMatch?: number;
  employerNonMatch?: number;
  loanRepayment?: number;
  status?: 'PENDING' | 'VALIDATED' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';
}

interface ListQuery {
  page: number;
  limit: number;
  employeeId?: string;
  planId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export class ContributionsService {
  private auditService = new AuditService();

  async create(data: CreateContributionData, userId: string) {
    // Check for idempotency
    if (data.idempotencyKey) {
      const existing = await prisma.contribution.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
      });
      if (existing) {
        return existing;
      }
    }

    // Validate employee and plan exist
    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
      include: { plan: true },
    });

    if (!employee) {
      throw createError('Employee not found', 404, 'NOT_FOUND');
    }

    if (employee.planId !== data.planId) {
      throw createError('Employee is not enrolled in this plan', 400, 'VALIDATION_ERROR');
    }

    // Validate against plan limits
    const totalEmployeeContribution = data.employeePreTax + (data.employeeRoth ?? 0);
    if (totalEmployeeContribution > employee.plan.employeeContributionLimit) {
      throw createError('Contribution exceeds plan limit', 400, 'CONTRIBUTION_LIMIT_EXCEEDED');
    }

    const contribution = await prisma.contribution.create({
      data: {
        employeeId: data.employeeId,
        planId: data.planId,
        payrollDate: new Date(data.payrollDate),
        employeePreTax: data.employeePreTax,
        employeeRoth: data.employeeRoth ?? 0,
        employerMatch: data.employerMatch ?? 0,
        employerNonMatch: data.employerNonMatch ?? 0,
        loanRepayment: data.loanRepayment ?? 0,
        idempotencyKey: data.idempotencyKey,
        createdBy: userId,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entityType: 'Contribution',
      entityId: contribution.id,
      newValues: data,
    });

    return contribution;
  }

  async list(query: ListQuery, organizationId: string) {
    const where: Record<string, unknown> = {
      deletedAt: null,
      employee: { organizationId },
    };

    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.planId) where.planId = query.planId;
    if (query.status) where.status = query.status;
    if (query.startDate || query.endDate) {
      where.payrollDate = {};
      if (query.startDate) (where.payrollDate as Record<string, Date>).gte = new Date(query.startDate);
      if (query.endDate) (where.payrollDate as Record<string, Date>).lte = new Date(query.endDate);
    }

    const [contributions, total] = await Promise.all([
      prisma.contribution.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { payrollDate: 'desc' },
        include: {
          employee: { select: { id: true, employeeNumber: true } },
        },
      }),
      prisma.contribution.count({ where }),
    ]);

    return {
      data: contributions,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getById(id: string, organizationId: string) {
    const contribution = await prisma.contribution.findFirst({
      where: {
        id,
        deletedAt: null,
        employee: { organizationId },
      },
      include: {
        employee: { select: { id: true, employeeNumber: true } },
        plan: { select: { id: true, name: true, planNumber: true } },
      },
    });

    if (!contribution) {
      throw createError('Contribution not found', 404, 'NOT_FOUND');
    }

    return contribution;
  }

  async update(id: string, data: UpdateContributionData, userId: string) {
    const existing = await prisma.contribution.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw createError('Contribution not found', 404, 'NOT_FOUND');
    }

    if (existing.status === 'CONFIRMED') {
      throw createError('Cannot modify confirmed contribution', 400, 'INVALID_OPERATION');
    }

    const contribution = await prisma.contribution.update({
      where: { id },
      data: {
        ...data,
        updatedBy: userId,
      },
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entityType: 'Contribution',
      entityId: id,
      oldValues: existing,
      newValues: data,
    });

    return contribution;
  }

  async delete(id: string, userId: string) {
    const existing = await prisma.contribution.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw createError('Contribution not found', 404, 'NOT_FOUND');
    }

    if (existing.status === 'CONFIRMED') {
      throw createError('Cannot delete confirmed contribution', 400, 'INVALID_OPERATION');
    }

    await prisma.contribution.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy: userId,
      },
    });

    await this.auditService.log({
      userId,
      action: 'DELETE',
      entityType: 'Contribution',
      entityId: id,
    });
  }
}
