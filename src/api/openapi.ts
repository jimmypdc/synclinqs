import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { config } from '../config/index.js';

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z);

// Create registry
const registry = new OpenAPIRegistry();

// ==============================================================================
// Common Schemas
// ==============================================================================

const ErrorSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
      message: z.string().openapi({ example: 'Invalid input data' }),
      details: z.array(z.object({
        field: z.string(),
        message: z.string(),
      })).optional(),
      requestId: z.string().optional(),
    }),
  })
  .openapi('Error');

const PaginationSchema = z
  .object({
    page: z.number().openapi({ example: 1 }),
    limit: z.number().openapi({ example: 50 }),
    total: z.number().openapi({ example: 100 }),
    totalPages: z.number().openapi({ example: 2 }),
  })
  .openapi('Pagination');

// Register common schemas
registry.register('Error', ErrorSchema);
registry.register('Pagination', PaginationSchema);

// ==============================================================================
// Health Endpoints
// ==============================================================================

registry.registerPath({
  method: 'get',
  path: '/health',
  summary: 'Health check',
  description: 'Basic liveness check for load balancers',
  tags: ['Health'],
  responses: {
    200: {
      description: 'Service is healthy',
      content: {
        'application/json': {
          schema: z.object({
            status: z.enum(['healthy']),
            timestamp: z.string().datetime(),
            version: z.string(),
            uptime: z.number(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/health/ready',
  summary: 'Readiness check',
  description: 'Check if service and all dependencies are ready',
  tags: ['Health'],
  responses: {
    200: {
      description: 'Service is ready',
      content: {
        'application/json': {
          schema: z.object({
            status: z.enum(['healthy', 'degraded', 'unhealthy']),
            timestamp: z.string().datetime(),
            version: z.string(),
            uptime: z.number(),
            checks: z.object({
              database: z.object({
                status: z.enum(['healthy', 'unhealthy']),
                latencyMs: z.number().optional(),
              }),
              redis: z.object({
                status: z.enum(['healthy', 'unhealthy']),
                latencyMs: z.number().optional(),
              }),
              queues: z.object({
                status: z.enum(['healthy', 'degraded', 'unhealthy']),
              }),
            }),
          }),
        },
      },
    },
    503: {
      description: 'Service is not ready',
    },
  },
});

// ==============================================================================
// Contributions Endpoints
// ==============================================================================

const ContributionSchema = z
  .object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    employeeId: z.string().uuid(),
    planId: z.string().uuid(),
    payPeriodStart: z.string().datetime(),
    payPeriodEnd: z.string().datetime(),
    contributionDate: z.string().datetime(),
    employeePreTax: z.number().int().describe('Amount in cents'),
    employeeRoth: z.number().int(),
    employerMatch: z.number().int(),
    employerNonElective: z.number().int(),
    loanRepayment: z.number().int(),
    totalAmount: z.number().int(),
    status: z.enum(['PENDING', 'VALIDATED', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'CANCELLED']),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('Contribution');

registry.register('Contribution', ContributionSchema);

registry.registerPath({
  method: 'post',
  path: '/api/v1/contributions',
  summary: 'Create contribution',
  description: 'Create a new contribution record',
  tags: ['Contributions'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            employeeId: z.string().uuid(),
            planId: z.string().uuid(),
            payPeriodStart: z.string().datetime(),
            payPeriodEnd: z.string().datetime(),
            contributionDate: z.string().datetime(),
            employeePreTax: z.number().int().min(0),
            employeeRoth: z.number().int().min(0).optional(),
            employerMatch: z.number().int().min(0).optional(),
            employerNonElective: z.number().int().min(0).optional(),
            loanRepayment: z.number().int().min(0).optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Contribution created',
      content: {
        'application/json': {
          schema: ContributionSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/contributions',
  summary: 'List contributions',
  description: 'List contributions with optional filtering',
  tags: ['Contributions'],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      status: z.enum(['PENDING', 'VALIDATED', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'CANCELLED']).optional(),
      employeeId: z.string().uuid().optional(),
      planId: z.string().uuid().optional(),
    }),
  },
  responses: {
    200: {
      description: 'List of contributions',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(ContributionSchema),
            pagination: PaginationSchema,
          }),
        },
      },
    },
  },
});

// ==============================================================================
// Jobs Endpoints
// ==============================================================================

const JobSchema = z
  .object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    name: z.string(),
    jobType: z.enum([
      'CONTRIBUTION_SYNC',
      'EMPLOYEE_SYNC',
      'ELECTION_SYNC',
      'RECONCILIATION',
      'FILE_EXPORT',
      'CLEANUP',
      'REPORT_GENERATION',
    ]),
    scheduleCron: z.string().nullable(),
    timezone: z.string(),
    isActive: z.boolean(),
    lastRunAt: z.string().datetime().nullable(),
    nextRunAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('Job');

registry.register('Job', JobSchema);

registry.registerPath({
  method: 'get',
  path: '/api/v1/jobs',
  summary: 'List scheduled jobs',
  description: 'List all scheduled jobs for the organization',
  tags: ['Jobs'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'List of jobs',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(JobSchema),
            pagination: PaginationSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/jobs/{id}/run',
  summary: 'Execute job',
  description: 'Manually trigger a job execution',
  tags: ['Jobs'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Job execution started',
      content: {
        'application/json': {
          schema: z.object({
            executionId: z.string().uuid(),
            status: z.enum(['PENDING', 'RUNNING']),
          }),
        },
      },
    },
  },
});

// ==============================================================================
// Security Schemes
// ==============================================================================

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

// ==============================================================================
// Generate OpenAPI Document
// ==============================================================================

export function generateOpenAPIDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'SyncLinqs API',
      version: config.apiVersion,
      description: `
SyncLinqs provides seamless, secure integration between 401(k) recordkeepers and payroll systems.

## Authentication

All API endpoints require authentication via JWT bearer token. Include the token in the Authorization header:

\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Rate Limiting

API requests are rate-limited per organization based on your billing plan.

## Pagination

List endpoints support pagination via \`page\` and \`limit\` query parameters.
      `,
      contact: {
        name: 'SyncLinqs Support',
        email: 'support@synclinqs.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.synclinqs.com',
        description: 'Production server',
      },
    ],
  });
}

export { registry };
