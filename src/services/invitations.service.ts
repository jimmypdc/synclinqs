import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma.js';
import { createError } from '../api/middleware/errorHandler.js';
import { AuditService } from './audit.service.js';
import { EmailService } from './email.service.js';
import { logger } from '../utils/logger.js';

interface CreateInvitationData {
  email: string;
  role?: 'ADMIN' | 'USER' | 'READONLY';
}

export class InvitationsService {
  private auditService = new AuditService();
  private emailService = new EmailService();

  async create(data: CreateInvitationData, organizationId: string, invitedBy: string) {
    // Check if email is already a user in this organization
    const existingUser = await prisma.user.findFirst({
      where: {
        email: data.email,
        organizationId,
        deletedAt: null,
      },
    });

    if (existingUser) {
      throw createError('User is already a member of this organization', 409, 'USER_ALREADY_MEMBER');
    }

    // Check if there's already a pending invitation
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email: data.email,
        organizationId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      throw createError('An invitation has already been sent to this email', 409, 'INVITATION_EXISTS');
    }

    // Create invitation token
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const invitation = await prisma.invitation.create({
      data: {
        email: data.email,
        organizationId,
        role: data.role ?? 'USER',
        token,
        expiresAt,
        invitedBy,
      },
      include: {
        organization: { select: { id: true, name: true } },
        inviter: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    await this.auditService.log({
      userId: invitedBy,
      action: 'INVITE_USER',
      entityType: 'Invitation',
      entityId: invitation.id,
      newValues: {
        email: data.email,
        role: data.role ?? 'USER',
      },
    });

    logger.info('Invitation created', {
      invitationId: invitation.id,
      email: data.email,
      organizationId,
    });

    // Send invitation email
    await this.emailService.sendInvitation({
      recipientEmail: data.email,
      inviterName: `${invitation.inviter.firstName} ${invitation.inviter.lastName}`,
      organizationName: invitation.organization.name,
      role: invitation.role,
      inviteToken: invitation.token,
      expiresAt: invitation.expiresAt,
    });

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      organization: invitation.organization,
      invitedBy: {
        name: `${invitation.inviter.firstName} ${invitation.inviter.lastName}`,
        email: invitation.inviter.email,
      },
      // Include token for development/testing - remove in production
      token: invitation.token,
    };
  }

  async getByToken(token: string) {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: { select: { id: true, name: true } },
        inviter: { select: { firstName: true, lastName: true } },
      },
    });

    if (!invitation) {
      throw createError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    }

    if (invitation.acceptedAt) {
      throw createError('Invitation has already been accepted', 400, 'INVITATION_ALREADY_ACCEPTED');
    }

    if (invitation.expiresAt < new Date()) {
      throw createError('Invitation has expired', 400, 'INVITATION_EXPIRED');
    }

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      organization: invitation.organization,
      invitedBy: `${invitation.inviter.firstName} ${invitation.inviter.lastName}`,
    };
  }

  async accept(token: string, userId: string) {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      throw createError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    }

    if (invitation.acceptedAt) {
      throw createError('Invitation has already been accepted', 400, 'INVITATION_ALREADY_ACCEPTED');
    }

    if (invitation.expiresAt < new Date()) {
      throw createError('Invitation has expired', 400, 'INVITATION_EXPIRED');
    }

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    await this.auditService.log({
      userId,
      action: 'ACCEPT_INVITATION',
      entityType: 'Invitation',
      entityId: invitation.id,
    });

    logger.info('Invitation accepted', {
      invitationId: invitation.id,
      userId,
    });

    return invitation;
  }

  async list(organizationId: string, options: { page: number; limit: number; status?: 'pending' | 'accepted' | 'expired' }) {
    const now = new Date();
    const where: Record<string, unknown> = { organizationId };

    if (options.status === 'pending') {
      where.acceptedAt = null;
      where.expiresAt = { gt: now };
    } else if (options.status === 'accepted') {
      where.acceptedAt = { not: null };
    } else if (options.status === 'expired') {
      where.acceptedAt = null;
      where.expiresAt = { lt: now };
    }

    const [invitations, total] = await Promise.all([
      prisma.invitation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.limit,
        take: options.limit,
        include: {
          inviter: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.invitation.count({ where }),
    ]);

    return {
      data: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.acceptedAt ? 'accepted' : inv.expiresAt < now ? 'expired' : 'pending',
        expiresAt: inv.expiresAt,
        acceptedAt: inv.acceptedAt,
        invitedBy: `${inv.inviter.firstName} ${inv.inviter.lastName}`,
        createdAt: inv.createdAt,
      })),
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.ceil(total / options.limit),
      },
    };
  }

  async revoke(id: string, organizationId: string, userId: string) {
    const invitation = await prisma.invitation.findFirst({
      where: { id, organizationId },
    });

    if (!invitation) {
      throw createError('Invitation not found', 404, 'NOT_FOUND');
    }

    if (invitation.acceptedAt) {
      throw createError('Cannot revoke an accepted invitation', 400, 'INVITATION_ALREADY_ACCEPTED');
    }

    await prisma.invitation.delete({
      where: { id },
    });

    await this.auditService.log({
      userId,
      action: 'REVOKE_INVITATION',
      entityType: 'Invitation',
      entityId: id,
      oldValues: { email: invitation.email },
    });

    logger.info('Invitation revoked', { invitationId: id, organizationId });
  }
}
