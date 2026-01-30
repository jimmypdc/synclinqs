import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { InvitationsService } from '../../services/invitations.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'USER', 'READONLY']).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'accepted', 'expired']).optional(),
});

export class InvitationsController {
  private service = new InvitationsService();

  /**
   * Create a new invitation (requires ADMIN role)
   */
  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = createInvitationSchema.parse(req.body);
      const result = await this.service.create(
        data,
        req.user!.organizationId,
        req.user!.userId
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * List invitations for the organization (requires ADMIN role)
   */
  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = listQuerySchema.parse(req.query);
      const result = await this.service.list(req.user!.organizationId, query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get invitation details by token (public - for accept flow)
   */
  getByToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.params;
      const result = await this.service.getByToken(token!);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Revoke an invitation (requires ADMIN role)
   */
  revoke = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.service.revoke(id!, req.user!.organizationId, req.user!.userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
