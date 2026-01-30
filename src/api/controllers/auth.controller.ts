import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from '../../services/auth.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  organizationName: z.string().min(1).max(255),
  organizationType: z.enum(['PAYROLL_PROVIDER', 'RECORDKEEPER']),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

export class AuthController {
  private authService = new AuthService();

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = registerSchema.parse(req.body);
      const result = await this.authService.register(data);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const result = await this.authService.login(email, password);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = refreshSchema.parse(req.body);
      const result = await this.authService.refresh(refreshToken);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = refreshSchema.parse(req.body);
      await this.authService.logout(refreshToken);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  me = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
        return;
      }
      const user = await this.authService.getProfile(req.user.userId);
      res.json(user);
    } catch (error) {
      next(error);
    }
  };
}
