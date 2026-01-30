import { prisma } from '../lib/prisma.js';
import { createError } from '../api/middleware/errorHandler.js';
import { AuditService } from './audit.service.js';
import { getApiUsageStats } from '../api/middleware/organizationRateLimiter.js';
import { logger } from '../utils/logger.js';

interface CreateOrganizationData {
  name: string;
  type: 'PAYROLL_PROVIDER' | 'RECORDKEEPER';
  billingPlan?: string;
}

interface UpdateOrganizationData {
  name?: string;
  billingPlan?: string;
  subscriptionStatus?: string;
  maxEmployees?: number | null;
  maxApiCallsPerMonth?: number | null;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// Plan limits configuration
const PLAN_LIMITS = {
  trial: { maxEmployees: 50, maxApiCalls: 1000 },
  starter: { maxEmployees: 500, maxApiCalls: 10000 },
  professional: { maxEmployees: 5000, maxApiCalls: 100000 },
  enterprise: { maxEmployees: null, maxApiCalls: null }, // Unlimited
};

export class OrganizationService {
  private auditService = new AuditService();

  async create(data: CreateOrganizationData, createdBy?: string) {
    const slug = this.generateSlug(data.name);
    const billingPlan = data.billingPlan ?? 'trial';
    const limits = this.getPlanLimits(billingPlan);

    // Check for slug uniqueness
    const existingSlug = await prisma.organization.findUnique({
      where: { slug },
    });

    const finalSlug = existingSlug ? `${slug}-${Date.now().toString(36)}` : slug;

    const organization = await prisma.organization.create({
      data: {
        name: data.name,
        slug: finalSlug,
        type: data.type,
        billingPlan,
        subscriptionStatus: 'active',
        maxEmployees: limits.maxEmployees,
        maxApiCallsPerMonth: limits.maxApiCalls,
        settings: {},
        metadata: {},
        createdBy,
      },
    });

    await this.auditService.log({
      organizationId: organization.id,
      userId: createdBy,
      action: 'CREATE',
      entityType: 'Organization',
      entityId: organization.id,
      newValues: {
        name: organization.name,
        slug: organization.slug,
        type: organization.type,
        billingPlan: organization.billingPlan,
      },
    });

    logger.info('Organization created', {
      organizationId: organization.id,
      name: organization.name,
      billingPlan,
    });

    return organization;
  }

  async getById(id: string) {
    const organization = await prisma.organization.findUnique({
      where: { id },
    });

    if (!organization || organization.deletedAt) {
      throw createError('Organization not found', 404, 'NOT_FOUND');
    }

    return organization;
  }

  async getBySlug(slug: string) {
    const organization = await prisma.organization.findUnique({
      where: { slug },
    });

    if (!organization || organization.deletedAt) {
      throw createError('Organization not found', 404, 'NOT_FOUND');
    }

    return organization;
  }

  async update(id: string, data: UpdateOrganizationData, updatedBy: string) {
    const existing = await this.getById(id);

    const updateData: Record<string, unknown> = {
      updatedBy,
    };

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.billingPlan !== undefined) {
      updateData.billingPlan = data.billingPlan;
      // Update limits based on new plan unless explicitly set
      if (data.maxEmployees === undefined && data.maxApiCallsPerMonth === undefined) {
        const limits = this.getPlanLimits(data.billingPlan);
        updateData.maxEmployees = limits.maxEmployees;
        updateData.maxApiCallsPerMonth = limits.maxApiCalls;
      }
    }

    if (data.subscriptionStatus !== undefined) {
      updateData.subscriptionStatus = data.subscriptionStatus;
    }

    if (data.maxEmployees !== undefined) {
      updateData.maxEmployees = data.maxEmployees;
    }

    if (data.maxApiCallsPerMonth !== undefined) {
      updateData.maxApiCallsPerMonth = data.maxApiCallsPerMonth;
    }

    if (data.settings !== undefined) {
      updateData.settings = { ...((existing.settings as object) ?? {}), ...data.settings };
    }

    if (data.metadata !== undefined) {
      updateData.metadata = { ...((existing.metadata as object) ?? {}), ...data.metadata };
    }

    const organization = await prisma.organization.update({
      where: { id },
      data: updateData,
    });

    await this.auditService.log({
      organizationId: id,
      userId: updatedBy,
      action: 'UPDATE',
      entityType: 'Organization',
      entityId: id,
      oldValues: {
        name: existing.name,
        billingPlan: existing.billingPlan,
        subscriptionStatus: existing.subscriptionStatus,
      },
      newValues: {
        name: organization.name,
        billingPlan: organization.billingPlan,
        subscriptionStatus: organization.subscriptionStatus,
      },
    });

    return organization;
  }

  async checkLimits(organizationId: string): Promise<{
    employees: { used: number; limit: number | null; remaining: number | null };
    apiCalls: { used: number; limit: number | null; remaining: number | null };
    isOverLimit: boolean;
  }> {
    const [organization, employeeCount, apiUsage] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId } }),
      prisma.employee.count({
        where: { organizationId, deletedAt: null },
      }),
      getApiUsageStats(organizationId).catch(() => ({ daily: 0, monthly: 0 })),
    ]);

    const maxEmployees = organization?.maxEmployees ?? null;
    const maxApiCalls = organization?.maxApiCallsPerMonth ?? null;

    const employeesRemaining = maxEmployees !== null ? maxEmployees - employeeCount : null;
    const apiCallsRemaining = maxApiCalls !== null ? maxApiCalls - apiUsage.monthly : null;

    const isOverLimit =
      (employeesRemaining !== null && employeesRemaining < 0) ||
      (apiCallsRemaining !== null && apiCallsRemaining < 0);

    return {
      employees: {
        used: employeeCount,
        limit: maxEmployees,
        remaining: employeesRemaining,
      },
      apiCalls: {
        used: apiUsage.monthly,
        limit: maxApiCalls,
        remaining: apiCallsRemaining,
      },
      isOverLimit,
    };
  }

  async canAddEmployees(organizationId: string, count: number = 1): Promise<boolean> {
    const limits = await this.checkLimits(organizationId);

    if (limits.employees.limit === null) {
      return true; // No limit
    }

    return (limits.employees.remaining ?? 0) >= count;
  }

  async getStats(organizationId: string): Promise<{
    employeeCount: number;
    activeEmployeeCount: number;
    integrationCount: number;
    activeIntegrationCount: number;
    contributionCount: number;
    pendingContributionCount: number;
    lastSyncAt: Date | null;
  }> {
    const [
      employeeCount,
      activeEmployeeCount,
      integrationCount,
      activeIntegrationCount,
      contributionCount,
      pendingContributionCount,
      lastSync,
    ] = await Promise.all([
      prisma.employee.count({
        where: { organizationId, deletedAt: null },
      }),
      prisma.employee.count({
        where: { organizationId, deletedAt: null, status: 'ACTIVE' },
      }),
      prisma.integration.count({
        where: { organizationId, deletedAt: null },
      }),
      prisma.integration.count({
        where: { organizationId, deletedAt: null, status: 'ACTIVE' },
      }),
      prisma.contribution.count({
        where: {
          employee: { organizationId },
          deletedAt: null,
        },
      }),
      prisma.contribution.count({
        where: {
          employee: { organizationId },
          deletedAt: null,
          status: 'PENDING',
        },
      }),
      prisma.integration.findFirst({
        where: { organizationId, lastSyncAt: { not: null } },
        orderBy: { lastSyncAt: 'desc' },
        select: { lastSyncAt: true },
      }),
    ]);

    return {
      employeeCount,
      activeEmployeeCount,
      integrationCount,
      activeIntegrationCount,
      contributionCount,
      pendingContributionCount,
      lastSyncAt: lastSync?.lastSyncAt ?? null,
    };
  }

  async suspendOrganization(id: string, reason: string, suspendedBy: string): Promise<void> {
    await prisma.organization.update({
      where: { id },
      data: {
        subscriptionStatus: 'suspended',
        metadata: {
          suspensionReason: reason,
          suspendedAt: new Date().toISOString(),
          suspendedBy,
        },
      },
    });

    await this.auditService.log({
      organizationId: id,
      userId: suspendedBy,
      action: 'SUSPEND',
      entityType: 'Organization',
      entityId: id,
      newValues: { reason },
    });

    logger.warn('Organization suspended', { organizationId: id, reason });
  }

  async reactivateOrganization(id: string, reactivatedBy: string): Promise<void> {
    await prisma.organization.update({
      where: { id },
      data: {
        subscriptionStatus: 'active',
      },
    });

    await this.auditService.log({
      organizationId: id,
      userId: reactivatedBy,
      action: 'REACTIVATE',
      entityType: 'Organization',
      entityId: id,
    });

    logger.info('Organization reactivated', { organizationId: id });
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100);
  }

  private getPlanLimits(plan: string): { maxEmployees: number | null; maxApiCalls: number | null } {
    const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];
    return limits ?? PLAN_LIMITS.trial;
  }
}
