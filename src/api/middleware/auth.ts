import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { createError } from './errorHandler.js';
import { prisma } from '../../lib/prisma.js';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  organizationId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw createError('No token provided', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.substring(7);

    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw createError('User not found or inactive', 401, 'UNAUTHORIZED');
    }

    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(createError('Invalid token', 401, 'UNAUTHORIZED'));
      return;
    }
    if (error instanceof jwt.TokenExpiredError) {
      next(createError('Token expired', 401, 'TOKEN_EXPIRED'));
      return;
    }
    next(error);
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(createError('Not authenticated', 401, 'UNAUTHORIZED'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(createError('Insufficient permissions', 403, 'FORBIDDEN'));
      return;
    }

    next();
  };
}
