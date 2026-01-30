import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { prisma } from '../lib/prisma.js';
import { createError } from '../api/middleware/errorHandler.js';
import { AuditService } from './audit.service.js';
import type { JwtPayload } from '../api/middleware/auth.js';

const jwtSignOptions: SignOptions = {
  expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'],
};

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
  organizationType: 'PAYROLL_PROVIDER' | 'RECORDKEEPER';
}

interface RegisterWithInviteData {
  inviteToken: string;
  password: string;
  firstName: string;
  lastName: string;
}

export class AuthService {
  private auditService = new AuditService();

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100);
  }

  async register(data: RegisterData): Promise<{
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
    };
    organization: {
      id: string;
      name: string;
      type: string;
    };
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
  }> {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw createError('Email already registered', 409, 'EMAIL_EXISTS');
    }

    // Create organization and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Generate unique slug
      const baseSlug = this.generateSlug(data.organizationName);
      const existingSlug = await tx.organization.findUnique({
        where: { slug: baseSlug },
      });
      const slug = existingSlug ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: data.organizationName,
          slug,
          type: data.organizationType,
          status: 'ACTIVE',
          billingPlan: 'trial',
          subscriptionStatus: 'active',
          maxEmployees: 50,
          maxApiCallsPerMonth: 1000,
          settings: {},
          metadata: {},
        },
      });

      // Hash password
      const passwordHash = await bcrypt.hash(data.password, 12);

      // Create user as ADMIN of the new organization
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          role: 'ADMIN',
          status: 'ACTIVE',
          organizationId: organization.id,
        },
      });

      return { user, organization };
    });

    // Generate tokens
    const payload: JwtPayload = {
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
      organizationId: result.organization.id,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, jwtSignOptions);

    const refreshToken = uuidv4();
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: result.user.id,
        expiresAt: refreshExpiresAt,
      },
    });

    await this.auditService.log({
      userId: result.user.id,
      action: 'REGISTER',
      entityType: 'User',
      entityId: result.user.id,
      newValues: {
        email: data.email,
        organizationName: data.organizationName,
        organizationType: data.organizationType,
      },
    });

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
      },
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        type: result.organization.type,
      },
      accessToken,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
    };
  }

  async login(email: string, password: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
  }> {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, jwtSignOptions);

    const refreshToken = uuidv4();
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: refreshExpiresAt,
      },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
    };
  }

  async refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
  }> {
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw createError('Invalid refresh token', 401, 'INVALID_TOKEN');
    }

    if (storedToken.user.status !== 'ACTIVE') {
      throw createError('User inactive', 401, 'USER_INACTIVE');
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Generate new tokens
    const payload: JwtPayload = {
      userId: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role,
      organizationId: storedToken.user.organizationId,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, jwtSignOptions);

    const newRefreshToken = uuidv4();
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: storedToken.user.id,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: config.jwt.expiresIn,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revokedAt: new Date() },
    });
  }

  async getProfile(userId: string): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    organization: { id: string; name: string };
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: { select: { id: true, name: true } } },
    });

    if (!user) {
      throw createError('User not found', 404, 'NOT_FOUND');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organization: user.organization,
    };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async registerWithInvitation(data: RegisterWithInviteData): Promise<{
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
    };
    organization: {
      id: string;
      name: string;
      type: string;
    };
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
  }> {
    // Find and validate the invitation
    const invitation = await prisma.invitation.findUnique({
      where: { token: data.inviteToken },
      include: { organization: true },
    });

    if (!invitation) {
      throw createError('Invalid invitation token', 404, 'INVITATION_NOT_FOUND');
    }

    if (invitation.acceptedAt) {
      throw createError('Invitation has already been accepted', 400, 'INVITATION_ALREADY_ACCEPTED');
    }

    if (invitation.expiresAt < new Date()) {
      throw createError('Invitation has expired', 400, 'INVITATION_EXPIRED');
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email },
    });

    if (existingUser) {
      throw createError('Email already registered', 409, 'EMAIL_EXISTS');
    }

    // Create user and mark invitation as accepted in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Hash password
      const passwordHash = await bcrypt.hash(data.password, 12);

      // Create user with the invitation's email, role, and organization
      const user = await tx.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          role: invitation.role,
          status: 'ACTIVE',
          organizationId: invitation.organizationId,
        },
      });

      // Mark invitation as accepted
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      return { user, organization: invitation.organization };
    });

    // Generate tokens
    const payload: JwtPayload = {
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
      organizationId: result.organization.id,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, jwtSignOptions);

    const refreshToken = uuidv4();
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: result.user.id,
        expiresAt: refreshExpiresAt,
      },
    });

    await this.auditService.log({
      userId: result.user.id,
      action: 'REGISTER_WITH_INVITATION',
      entityType: 'User',
      entityId: result.user.id,
      newValues: {
        email: invitation.email,
        organizationId: invitation.organizationId,
        invitationId: invitation.id,
      },
    });

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
      },
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        type: result.organization.type,
      },
      accessToken,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
    };
  }

  async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string }
  ): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  }> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE_PROFILE',
      entityType: 'User',
      entityId: userId,
      newValues: data,
    });

    return user;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      throw createError('User not found', 404, 'NOT_FOUND');
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw createError('Current password is incorrect', 400, 'INVALID_PASSWORD');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Revoke all refresh tokens for security
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.auditService.log({
      userId,
      action: 'CHANGE_PASSWORD',
      entityType: 'User',
      entityId: userId,
    });
  }
}
