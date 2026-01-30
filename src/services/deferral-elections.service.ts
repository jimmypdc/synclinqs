import { prisma } from '../lib/prisma.js';
import { createError } from '../api/middleware/errorHandler.js';
import { AuditService } from './audit.service.js';

interface CreateDeferralElectionData {
  employeeId: string;
  preTaxPercent: number;
  rothPercent?: number;
  catchUpPercent?: number;
  effectiveDate: string;
}

interface UpdateDeferralElectionData {
  preTaxPercent?: number;
  rothPercent?: number;
  catchUpPercent?: number;
  effectiveDate?: string;
  status?: 'PENDING' | 'ACTIVE' | 'SUPERSEDED' | 'CANCELLED';
}

interface ListQuery {
  page: number;
  limit: number;
  employeeId?: string;
  status?: string;
}

// Maximum total deferral percentage (100% = 10000 basis points)
const MAX_TOTAL_PERCENT = 10000;
// Maximum catch-up contribution only applies to employees 50+
const MAX_CATCH_UP_PERCENT = 10000;

export class DeferralElectionsService {
  private auditService = new AuditService();

  async create(data: CreateDeferralElectionData, organizationId: string, userId: string) {
    // Verify employee exists and belongs to organization
    const employee = await prisma.employee.findFirst({
      where: { id: data.employeeId, organizationId, deletedAt: null },
    });

    if (!employee) {
      throw createError('Employee not found', 404, 'NOT_FOUND');
    }

    // Validate total percentage doesn't exceed 100%
    const totalPercent = data.preTaxPercent + (data.rothPercent ?? 0) + (data.catchUpPercent ?? 0);
    if (totalPercent > MAX_TOTAL_PERCENT) {
      throw createError(
        `Total deferral percentage cannot exceed 100%. Current: ${(totalPercent / 100).toFixed(2)}%`,
        400,
        'INVALID_PERCENTAGE'
      );
    }

    // Validate individual percentages are non-negative
    if (data.preTaxPercent < 0 || (data.rothPercent ?? 0) < 0 || (data.catchUpPercent ?? 0) < 0) {
      throw createError('Deferral percentages cannot be negative', 400, 'INVALID_PERCENTAGE');
    }

    const effectiveDate = new Date(data.effectiveDate);

    // Supersede any existing active or pending elections with same or later effective date
    await prisma.deferralElection.updateMany({
      where: {
        employeeId: data.employeeId,
        status: { in: ['ACTIVE', 'PENDING'] },
        effectiveDate: { gte: effectiveDate },
        deletedAt: null,
      },
      data: { status: 'SUPERSEDED', updatedBy: userId },
    });

    // Create new election
    const election = await prisma.deferralElection.create({
      data: {
        employeeId: data.employeeId,
        preTaxPercent: data.preTaxPercent,
        rothPercent: data.rothPercent ?? 0,
        catchUpPercent: data.catchUpPercent ?? 0,
        effectiveDate,
        status: effectiveDate <= new Date() ? 'ACTIVE' : 'PENDING',
        createdBy: userId,
      },
      include: {
        employee: {
          select: { employeeNumber: true },
        },
      },
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entityType: 'DeferralElection',
      entityId: election.id,
      newValues: {
        employeeId: data.employeeId,
        preTaxPercent: data.preTaxPercent,
        rothPercent: data.rothPercent ?? 0,
        catchUpPercent: data.catchUpPercent ?? 0,
        effectiveDate: data.effectiveDate,
      },
    });

    return this.formatElection(election);
  }

  async list(query: ListQuery, organizationId: string) {
    // Get employee IDs for this organization
    const employeeIds = await prisma.employee.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true },
    });
    const orgEmployeeIds = employeeIds.map((e) => e.id);

    const where: Record<string, unknown> = {
      employeeId: { in: orgEmployeeIds },
      deletedAt: null,
    };

    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = query.status;

    const [elections, total] = await Promise.all([
      prisma.deferralElection.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          employee: {
            select: { employeeNumber: true },
          },
        },
      }),
      prisma.deferralElection.count({ where }),
    ]);

    return {
      data: elections.map((e) => this.formatElection(e)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getById(id: string, organizationId: string) {
    const election = await prisma.deferralElection.findFirst({
      where: { id, deletedAt: null },
      include: {
        employee: {
          select: { id: true, employeeNumber: true, organizationId: true },
        },
      },
    });

    if (!election || election.employee.organizationId !== organizationId) {
      throw createError('Deferral election not found', 404, 'NOT_FOUND');
    }

    return this.formatElection(election);
  }

  async getActiveForEmployee(employeeId: string, organizationId: string) {
    // Verify employee belongs to organization
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
    });

    if (!employee) {
      throw createError('Employee not found', 404, 'NOT_FOUND');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const election = await prisma.deferralElection.findFirst({
      where: {
        employeeId,
        status: 'ACTIVE',
        effectiveDate: { lte: today },
        OR: [{ endDate: null }, { endDate: { gte: today } }],
        deletedAt: null,
      },
      orderBy: { effectiveDate: 'desc' },
      include: {
        employee: { select: { employeeNumber: true } },
      },
    });

    if (!election) {
      return null;
    }

    return this.formatElection(election);
  }

  async update(id: string, data: UpdateDeferralElectionData, organizationId: string, userId: string) {
    const existing = await prisma.deferralElection.findFirst({
      where: { id, deletedAt: null },
      include: {
        employee: { select: { organizationId: true } },
      },
    });

    if (!existing || existing.employee.organizationId !== organizationId) {
      throw createError('Deferral election not found', 404, 'NOT_FOUND');
    }

    // Can only update PENDING elections (or cancel ACTIVE ones)
    if (existing.status !== 'PENDING' && data.status !== 'CANCELLED') {
      throw createError('Can only modify pending elections', 400, 'INVALID_STATUS');
    }

    // Validate percentages if updating them
    const preTax = data.preTaxPercent ?? existing.preTaxPercent;
    const roth = data.rothPercent ?? existing.rothPercent;
    const catchUp = data.catchUpPercent ?? existing.catchUpPercent;
    const totalPercent = preTax + roth + catchUp;

    if (totalPercent > MAX_TOTAL_PERCENT) {
      throw createError(
        `Total deferral percentage cannot exceed 100%. Current: ${(totalPercent / 100).toFixed(2)}%`,
        400,
        'INVALID_PERCENTAGE'
      );
    }

    const updateData: Record<string, unknown> = { updatedBy: userId };
    if (data.preTaxPercent !== undefined) updateData.preTaxPercent = data.preTaxPercent;
    if (data.rothPercent !== undefined) updateData.rothPercent = data.rothPercent;
    if (data.catchUpPercent !== undefined) updateData.catchUpPercent = data.catchUpPercent;
    if (data.effectiveDate) updateData.effectiveDate = new Date(data.effectiveDate);
    if (data.status) updateData.status = data.status;

    const election = await prisma.deferralElection.update({
      where: { id },
      data: updateData,
      include: {
        employee: { select: { employeeNumber: true } },
      },
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entityType: 'DeferralElection',
      entityId: id,
      oldValues: {
        preTaxPercent: existing.preTaxPercent,
        rothPercent: existing.rothPercent,
        catchUpPercent: existing.catchUpPercent,
        status: existing.status,
      },
      newValues: data as Record<string, unknown>,
    });

    return this.formatElection(election);
  }

  async delete(id: string, organizationId: string, userId: string) {
    const existing = await prisma.deferralElection.findFirst({
      where: { id, deletedAt: null },
      include: {
        employee: { select: { organizationId: true } },
      },
    });

    if (!existing || existing.employee.organizationId !== organizationId) {
      throw createError('Deferral election not found', 404, 'NOT_FOUND');
    }

    // Can only delete PENDING elections
    if (existing.status !== 'PENDING') {
      throw createError('Can only delete pending elections', 400, 'INVALID_STATUS');
    }

    await prisma.deferralElection.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: userId },
    });

    await this.auditService.log({
      userId,
      action: 'DELETE',
      entityType: 'DeferralElection',
      entityId: id,
    });
  }

  private formatElection(election: {
    id: string;
    employeeId: string;
    preTaxPercent: number;
    rothPercent: number;
    catchUpPercent: number;
    effectiveDate: Date;
    endDate: Date | null;
    status: string;
    createdAt: Date;
    employee?: { employeeNumber: string };
  }) {
    return {
      id: election.id,
      employeeId: election.employeeId,
      employeeNumber: election.employee?.employeeNumber,
      // Convert basis points to percentage for display
      preTaxPercent: election.preTaxPercent / 100,
      rothPercent: election.rothPercent / 100,
      catchUpPercent: election.catchUpPercent / 100,
      totalPercent: (election.preTaxPercent + election.rothPercent + election.catchUpPercent) / 100,
      effectiveDate: election.effectiveDate,
      endDate: election.endDate,
      status: election.status,
      createdAt: election.createdAt,
    };
  }
}
