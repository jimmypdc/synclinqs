import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { IntegrationsService } from '../../services/integrations.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const createIntegrationSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['SFTP', 'REST_API', 'SOAP', 'WEBHOOK']),
  config: z.record(z.unknown()),
});

const updateIntegrationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  config: z.record(z.unknown()).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ERROR']).optional(),
});

export class IntegrationsController {
  private service = new IntegrationsService();

  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = createIntegrationSchema.parse(req.body);
      const integration = await this.service.create(data, req.user!.organizationId, req.user!.userId);
      res.status(201).json(integration);
    } catch (error) {
      next(error);
    }
  };

  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.list(req.user!.organizationId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const integration = await this.service.getById(id!, req.user!.organizationId);
      res.json(integration);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data = updateIntegrationSchema.parse(req.body);
      const integration = await this.service.update(id!, data, req.user!.userId);
      res.json(integration);
    } catch (error) {
      next(error);
    }
  };

  triggerSync = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { integrationId } = req.body as { integrationId?: string };
      const result = await this.service.triggerSync(integrationId, req.user!.organizationId, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = await this.service.getStatus(req.user!.organizationId);
      res.json(status);
    } catch (error) {
      next(error);
    }
  };
}
