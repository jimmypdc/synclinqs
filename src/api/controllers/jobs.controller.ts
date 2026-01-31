import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { JobSchedulerService } from '../../services/job-scheduler.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const createJobSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  jobType: z.enum([
    'CONTRIBUTION_SYNC',
    'EMPLOYEE_SYNC',
    'ELECTION_SYNC',
    'RECONCILIATION',
    'FILE_EXPORT',
    'CLEANUP',
    'REPORT_GENERATION',
  ]),
  sourceSystem: z.string().max(100).optional(),
  destinationSystem: z.string().max(100).optional(),
  integrationId: z.string().uuid().optional(),
  mappingConfigId: z.string().uuid().optional(),
  scheduleCron: z.string().max(100).optional(),
  timezone: z.string().max(50).optional(),
  configuration: z
    .object({
      batchSize: z.number().int().min(1).max(10000).optional(),
      timeout: z.number().int().min(1000).optional(),
      retryOnFailure: z.boolean().optional(),
      maxRetries: z.number().int().min(0).max(10).optional(),
      syncDirection: z.enum(['pull', 'push', 'bidirectional']).optional(),
      incrementalSync: z.boolean().optional(),
      exportFormat: z.enum(['csv', 'excel', 'json', 'xml']).optional(),
      retentionDays: z.number().int().min(1).max(365).optional(),
    })
    .passthrough()
    .optional(),
});

const updateJobSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  sourceSystem: z.string().max(100).optional(),
  destinationSystem: z.string().max(100).optional(),
  integrationId: z.string().uuid().nullable().optional(),
  mappingConfigId: z.string().uuid().nullable().optional(),
  scheduleCron: z.string().max(100).nullable().optional(),
  timezone: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
  configuration: z
    .object({
      batchSize: z.number().int().min(1).max(10000).optional(),
      timeout: z.number().int().min(1000).optional(),
      retryOnFailure: z.boolean().optional(),
      maxRetries: z.number().int().min(0).max(10).optional(),
      syncDirection: z.enum(['pull', 'push', 'bidirectional']).optional(),
      incrementalSync: z.boolean().optional(),
      exportFormat: z.enum(['csv', 'excel', 'json', 'xml']).optional(),
      retentionDays: z.number().int().min(1).max(365).optional(),
    })
    .passthrough()
    .optional(),
});

const listJobsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  jobType: z
    .enum([
      'CONTRIBUTION_SYNC',
      'EMPLOYEE_SYNC',
      'ELECTION_SYNC',
      'RECONCILIATION',
      'FILE_EXPORT',
      'CLEANUP',
      'REPORT_GENERATION',
    ])
    .optional(),
  isActive: z.coerce.boolean().optional(),
  sourceSystem: z.string().optional(),
  destinationSystem: z.string().optional(),
  hasSchedule: z.coerce.boolean().optional(),
});

const listExecutionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL', 'CANCELLED']).optional(),
  triggeredBy: z.enum(['SCHEDULED', 'MANUAL', 'API', 'WEBHOOK', 'SYSTEM']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const executeJobSchema = z.object({
  configuration: z.record(z.unknown()).optional(),
  dryRun: z.boolean().optional(),
});

const validateCronSchema = z.object({
  cron: z.string().min(1).max(100),
  timezone: z.string().max(50).optional(),
});

export class JobsController {
  private service = new JobSchedulerService();

  /**
   * GET /api/v1/jobs
   * List sync jobs
   */
  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = listJobsQuerySchema.parse(req.query);
      const result = await this.service.listJobs(req.user!.organizationId, query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/jobs
   * Create sync job
   */
  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = createJobSchema.parse(req.body);
      const job = await this.service.createJob(
        req.user!.organizationId,
        data,
        req.user!.userId
      );
      res.status(201).json(job);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/jobs/:id
   * Get sync job details
   */
  getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const job = await this.service.getJobById(id!, req.user!.organizationId);
      res.json(job);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/v1/jobs/:id
   * Update sync job
   */
  update = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data = updateJobSchema.parse(req.body);
      const job = await this.service.updateJob(
        id!,
        req.user!.organizationId,
        data,
        req.user!.userId
      );
      res.json(job);
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/v1/jobs/:id
   * Delete sync job
   */
  delete = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.service.deleteJob(id!, req.user!.organizationId, req.user!.userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/jobs/:id/run
   * Manually execute a job
   */
  execute = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data = executeJobSchema.parse(req.body);
      const result = await this.service.executeJob(
        id!,
        req.user!.organizationId,
        req.user!.userId,
        data
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/jobs/:id/executions
   * List job executions
   */
  listExecutions = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const query = listExecutionsQuerySchema.parse(req.query);
      const result = await this.service.listExecutions(id!, req.user!.organizationId, query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/jobs-stats
   * Get overall job stats
   */
  getStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.service.getOverallStats(req.user!.organizationId);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/jobs/validate-cron
   * Validate a cron expression
   */
  validateCron = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = validateCronSchema.parse(req.body);
      const validation = this.service.validateCronExpression(data.cron);
      if (validation.isValid) {
        const scheduleInfo = this.service.getScheduleInfo(data.cron, data.timezone);
        res.json({ ...validation, scheduleInfo });
      } else {
        res.status(400).json(validation);
      }
    } catch (error) {
      next(error);
    }
  };
}
