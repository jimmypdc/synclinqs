import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../utils/logger.js';

declare global {
  namespace Express {
    interface Request {
      organizationId?: string;
      organization?: {
        id: string;
        name: string;
        slug: string;
        billingPlan: string;
        subscriptionStatus: string;
        maxEmployees: number | null;
        maxApiCallsPerMonth: number | null;
      };
      idempotencyKey?: string;
    }
  }
}

/**
 * Tenant Context Middleware
 *
 * Sets the PostgreSQL session variable for Row-Level Security (RLS)
 * and attaches organization context to the request object.
 *
 * This middleware should be applied after authentication middleware.
 */
export async function tenantContext(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = req.user;

  if (!user?.organizationId) {
    // No user context - skip tenant isolation
    // RLS policies will allow access when app.current_organization_id is NULL
    return next();
  }

  try {
    // Set PostgreSQL session variable for RLS policies
    // This ensures all database queries are automatically filtered by organization
    await prisma.$executeRawUnsafe(
      `SET app.current_organization_id = '${user.organizationId}'`
    );

    // Attach organization ID to request for application-level checks
    req.organizationId = user.organizationId;

    // Optionally fetch organization details for limit checking
    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        billingPlan: true,
        subscriptionStatus: true,
        maxEmployees: true,
        maxApiCallsPerMonth: true,
      },
    });

    if (organization) {
      req.organization = organization;

      // Check subscription status
      if (organization.subscriptionStatus === 'suspended') {
        res.status(403).json({
          error: {
            code: 'SUBSCRIPTION_SUSPENDED',
            message: 'Your subscription has been suspended. Please contact support.',
          },
        });
        return;
      }

      if (organization.subscriptionStatus === 'cancelled') {
        res.status(403).json({
          error: {
            code: 'SUBSCRIPTION_CANCELLED',
            message: 'Your subscription has been cancelled.',
          },
        });
        return;
      }
    }

    logger.debug('Tenant context set', {
      organizationId: user.organizationId,
      organizationName: organization?.name,
    });

    next();
  } catch (error) {
    logger.error('Failed to set tenant context', {
      organizationId: user.organizationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    next(error);
  }
}

/**
 * Clear Tenant Context
 *
 * Resets the PostgreSQL session variable after request completion.
 * Can be used as response middleware if needed.
 */
export async function clearTenantContext(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`RESET app.current_organization_id`);
    next();
  } catch (error) {
    // Non-critical error, just log it
    logger.warn('Failed to clear tenant context', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    next();
  }
}
