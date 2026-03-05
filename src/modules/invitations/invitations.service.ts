import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateInvitationDto } from './dto';
import { InvitationEntity } from './entities';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InvitationsService {
    private readonly logger = new Logger(InvitationsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationsService: NotificationsService,
    ) {}

    /**
     * Send an invitation — creates a PENDING invitation with 7-day expiry.
     * One pending invitation per email per org (unique constraint).
     */
    async send(orgId: string, senderId: string, dto: CreateInvitationDto) {
        // Verify the org exists and is not soft-deleted
        const org = await this.prisma.organization.findFirst({
            where: { id: orgId, deletedAt: null },
        });
        if (!org) throw new NotFoundException('Organization not found');

        // Check if user is already a member
        const existingMember = await this.prisma.membership.findFirst({
            where: {
                organizationId: orgId,
                user: { email: dto.email },
            },
        });
        if (existingMember) {
            throw new ConflictException(
                'User is already a member of this organization',
            );
        }

        // Check for existing pending invitation
        const existing = await this.prisma.invitation.findUnique({
            where: {
                email_organizationId: {
                    email: dto.email,
                    organizationId: orgId,
                },
            },
        });

        if (existing && existing.status === 'PENDING') {
            throw new ConflictException(
                'A pending invitation already exists for this email',
            );
        }

        // If a previous non-pending invitation exists (declined/expired/revoked),
        // delete it so we can create a fresh one
        if (existing) {
            await this.prisma.invitation.delete({ where: { id: existing.id } });
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const invitation = await this.prisma.invitation.create({
            data: {
                email: dto.email,
                organizationId: orgId,
                role: dto.role ?? 'MEMBER',
                sentById: senderId,
                expiresAt,
            },
            include: {
                organization: { select: { id: true, name: true, slug: true } },
                sentBy: { select: { id: true, name: true, email: true } },
            },
        });

        // Email placeholder — would call EmailService.send() here
        this.logger.log(
            `Invitation sent to ${dto.email} for org ${org.name} (token: ${invitation.token})`,
        );

        return new InvitationEntity(invitation);
    }

    /**
     * List all invitations for an organization.
     */
    async findAllForOrg(orgId: string) {
        const invitations = await this.prisma.invitation.findMany({
            where: { organizationId: orgId },
            include: {
                sentBy: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return invitations.map((inv) => new InvitationEntity(inv));
    }

    /**
     * Revoke a pending invitation.
     */
    async revoke(orgId: string, invitationId: string) {
        const invitation = await this.prisma.invitation.findFirst({
            where: { id: invitationId, organizationId: orgId },
        });

        if (!invitation) {
            throw new NotFoundException('Invitation not found');
        }

        if (invitation.status !== 'PENDING') {
            throw new BadRequestException(
                `Cannot revoke invitation with status: ${invitation.status}`,
            );
        }

        const updated = await this.prisma.invitation.update({
            where: { id: invitation.id },
            data: { status: 'REVOKED' },
        });

        return new InvitationEntity(updated);
    }

    /**
     * Get invitation info by token — public endpoint for invitee.
     */
    async getByToken(token: string) {
        const invitation = await this.prisma.invitation.findUnique({
            where: { token },
            include: {
                organization: { select: { id: true, name: true, slug: true } },
                sentBy: { select: { id: true, name: true, email: true } },
            },
        });

        if (!invitation) {
            throw new NotFoundException('Invitation not found');
        }

        return new InvitationEntity(invitation);
    }

    /**
     * Accept an invitation — creates membership row, updates invitation status.
     */
    async accept(token: string, userId: string) {
        const invitation = await this.prisma.invitation.findUnique({
            where: { token },
            include: {
                organization: { select: { id: true, name: true, slug: true } },
            },
        });

        if (!invitation) {
            throw new NotFoundException('Invitation not found');
        }

        if (invitation.status !== 'PENDING') {
            throw new BadRequestException(
                `Invitation is no longer pending (status: ${invitation.status})`,
            );
        }

        if (new Date() > invitation.expiresAt) {
            // Mark as expired
            await this.prisma.invitation.update({
                where: { id: invitation.id },
                data: { status: 'EXPIRED' },
            });
            throw new BadRequestException('Invitation has expired');
        }

        // Check if user is already a member
        const existingMembership = await this.prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId: invitation.organizationId,
                },
            },
        });

        if (existingMembership) {
            throw new ConflictException(
                'You are already a member of this organization',
            );
        }

        // Transaction: create membership + update invitation
        const [, updatedInvitation] = await this.prisma.$transaction([
            this.prisma.membership.create({
                data: {
                    userId,
                    organizationId: invitation.organizationId,
                    role: invitation.role,
                    invitedById: invitation.sentById,
                },
            }),
            this.prisma.invitation.update({
                where: { id: invitation.id },
                data: {
                    status: 'ACCEPTED',
                    acceptedAt: new Date(),
                },
                include: {
                    organization: {
                        select: { id: true, name: true, slug: true },
                    },
                    sentBy: { select: { id: true, name: true, email: true } },
                },
            }),
        ]);

        // Email placeholder — would send WELCOME email here
        this.logger.log(
            `Invitation accepted: user ${userId} joined org ${invitation.organization.name}`,
        );

        // Notify org members about the new member (fire-and-forget)
        const members = await this.prisma.membership.findMany({
            where: {
                organizationId: invitation.organizationId,
                userId: { not: userId },
            },
            select: { userId: true },
        });
        this.notificationsService
            .createAndEmitMany(
                members.map((m) => m.userId),
                {
                    type: 'MEMBER_JOINED' as const,
                    title: `A new member joined ${invitation.organization.name}`,
                    resourceType: 'Organization',
                    resourceId: invitation.organizationId,
                },
            )
            .catch(() => {});

        return new InvitationEntity(updatedInvitation);
    }

    /**
     * Decline an invitation.
     */
    async decline(token: string) {
        const invitation = await this.prisma.invitation.findUnique({
            where: { token },
        });

        if (!invitation) {
            throw new NotFoundException('Invitation not found');
        }

        if (invitation.status !== 'PENDING') {
            throw new BadRequestException(
                `Invitation is no longer pending (status: ${invitation.status})`,
            );
        }

        const updated = await this.prisma.invitation.update({
            where: { id: invitation.id },
            data: { status: 'DECLINED' },
            include: {
                organization: { select: { id: true, name: true, slug: true } },
            },
        });

        return new InvitationEntity(updated);
    }
}
