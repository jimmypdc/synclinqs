import { prisma } from '../lib/prisma.js';
import { createError } from '../api/middleware/errorHandler.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { AuditService } from './audit.service.js';

interface CreateEmployeeData {
  planId: string;
  employeeNumber: string;
  ssn: string;
  firstName: string;
  lastName: string;
  email?: string;
  dateOfBirth?: string;
  hireDate: string;
}

interface UpdateEmployeeData {
  firstName?: string;
  lastName?: string;
  email?: string;
  terminationDate?: string;
  status?: 'ACTIVE' | 'TERMINATED' | 'ON_LEAVE' | 'SUSPENDED';
}

interface ListQuery {
  page: number;
  limit: number;
  planId?: string;
  status?: string;
  search?: string;
}

export class EmployeesService {
  private auditService = new AuditService();

  async create(data: CreateEmployeeData, organizationId: string, userId: string) {
    // Check for duplicate employee number
    const existing = await prisma.employee.findFirst({
      where: {
        organizationId,
        employeeNumber: data.employeeNumber,
        deletedAt: null,
      },
    });

    if (existing) {
      throw createError('Employee number already exists', 409, 'DUPLICATE');
    }

    // Verify plan exists and belongs to organization
    const plan = await prisma.plan.findFirst({
      where: { id: data.planId, organizationId, deletedAt: null },
    });

    if (!plan) {
      throw createError('Plan not found', 404, 'NOT_FOUND');
    }

    // Encrypt PII fields
    const employee = await prisma.employee.create({
      data: {
        organizationId,
        planId: data.planId,
        employeeNumber: data.employeeNumber,
        ssnEncrypted: encrypt(data.ssn),
        firstNameEncrypted: encrypt(data.firstName),
        lastNameEncrypted: encrypt(data.lastName),
        emailEncrypted: data.email ? encrypt(data.email) : null,
        dateOfBirthEncrypted: data.dateOfBirth ? encrypt(data.dateOfBirth) : null,
        hireDate: new Date(data.hireDate),
        createdBy: userId,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entityType: 'Employee',
      entityId: employee.id,
      // Don't log PII in audit
      newValues: { planId: data.planId, employeeNumber: data.employeeNumber },
    });

    return this.formatEmployee(employee);
  }

  async list(query: ListQuery, organizationId: string) {
    const where: Record<string, unknown> = {
      organizationId,
      deletedAt: null,
    };

    if (query.planId) where.planId = query.planId;
    if (query.status) where.status = query.status;

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.employee.count({ where }),
    ]);

    return {
      data: employees.map((e) => this.formatEmployee(e)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getById(id: string, organizationId: string) {
    const employee = await prisma.employee.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { plan: { select: { id: true, name: true, planNumber: true } } },
    });

    if (!employee) {
      throw createError('Employee not found', 404, 'NOT_FOUND');
    }

    return this.formatEmployee(employee);
  }

  async update(id: string, data: UpdateEmployeeData, userId: string) {
    const existing = await prisma.employee.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw createError('Employee not found', 404, 'NOT_FOUND');
    }

    const updateData: Record<string, unknown> = { updatedBy: userId };

    if (data.firstName) updateData.firstNameEncrypted = encrypt(data.firstName);
    if (data.lastName) updateData.lastNameEncrypted = encrypt(data.lastName);
    if (data.email) updateData.emailEncrypted = encrypt(data.email);
    if (data.terminationDate) updateData.terminationDate = new Date(data.terminationDate);
    if (data.status) updateData.status = data.status;

    const employee = await prisma.employee.update({
      where: { id },
      data: updateData,
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entityType: 'Employee',
      entityId: id,
      newValues: { status: data.status },
    });

    return this.formatEmployee(employee);
  }

  async delete(id: string, userId: string) {
    const existing = await prisma.employee.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw createError('Employee not found', 404, 'NOT_FOUND');
    }

    await prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: userId },
    });

    await this.auditService.log({
      userId,
      action: 'DELETE',
      entityType: 'Employee',
      entityId: id,
    });
  }

  private formatEmployee(employee: {
    id: string;
    employeeNumber: string;
    planId: string;
    ssnEncrypted: string;
    firstNameEncrypted: string;
    lastNameEncrypted: string;
    emailEncrypted: string | null;
    dateOfBirthEncrypted: string | null;
    hireDate: Date;
    terminationDate: Date | null;
    status: string;
    createdAt: Date;
    plan?: { id: string; name: string; planNumber: string };
  }) {
    return {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      planId: employee.planId,
      firstName: decrypt(employee.firstNameEncrypted),
      lastName: decrypt(employee.lastNameEncrypted),
      email: employee.emailEncrypted ? decrypt(employee.emailEncrypted) : null,
      // Mask SSN - only show last 4 digits
      ssnLast4: decrypt(employee.ssnEncrypted).slice(-4),
      dateOfBirth: employee.dateOfBirthEncrypted ? decrypt(employee.dateOfBirthEncrypted) : null,
      hireDate: employee.hireDate,
      terminationDate: employee.terminationDate,
      status: employee.status,
      createdAt: employee.createdAt,
      plan: employee.plan,
    };
  }
}
