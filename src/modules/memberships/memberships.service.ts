import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateMemberRoleDto } from './dto';
import { MembershipEntity } from './entities';
import { MembershipRole } from '../../generated/prisma/enums';

@Injectable()
export class MembershipsService {
    constructor(private readonly prisma: PrismaService) {}

    async findAll(orgId: string) {
        const memberships = await this.prisma.membership.findMany({
            where: { organizationId: orgId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        avatarUrl: true,
                    },
                },
            },
            orderBy: { joinedAt: 'asc' },
        });

        return memberships.map((m) => new MembershipEntity(m));
    }

    async updateRole(
        orgId: string,
        targetUserId: string,
        actorUserId: string,
        dto: UpdateMemberRoleDto,
    ) {
        const membership = await this.findMembership(orgId, targetUserId);

        // Cannot change the owner's role via this endpoint
        if (membership.role === 'OWNER') {
            throw new ForbiddenException(
                'Cannot change owner role — use transfer ownership instead',
            );
        }

        // Cannot promote someone to OWNER via this endpoint
        if (dto.role === 'OWNER') {
            throw new BadRequestException(
                'Use the transfer ownership endpoint to assign OWNER role',
            );
        }

        // Cannot change your own role
        if (targetUserId === actorUserId) {
            throw new BadRequestException('Cannot change your own role');
        }

        const updated = await this.prisma.membership.update({
            where: { id: membership.id },
            data: { role: dto.role },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        avatarUrl: true,
                    },
                },
            },
        });

        return new MembershipEntity(updated);
    }

    async removeMember(
        orgId: string,
        targetUserId: string,
        actorUserId: string,
    ) {
        const membership = await this.findMembership(orgId, targetUserId);

        // Cannot remove the owner
        if (membership.role === 'OWNER') {
            throw new ForbiddenException(
                'Cannot remove the organization owner',
            );
        }

        // Cannot remove yourself via this endpoint
        if (targetUserId === actorUserId) {
            throw new BadRequestException(
                'Use the leave endpoint to remove yourself',
            );
        }

        await this.prisma.membership.delete({
            where: { id: membership.id },
        });
    }

    async leaveOrganization(orgId: string, userId: string) {
        const membership = await this.findMembership(orgId, userId);

        // Owner cannot leave — must transfer first
        if (membership.role === 'OWNER') {
            throw new ForbiddenException(
                'Owner cannot leave — transfer ownership first',
            );
        }

        await this.prisma.membership.delete({
            where: { id: membership.id },
        });
    }

    async getMembershipRole(
        orgId: string,
        userId: string,
    ): Promise<MembershipRole | null> {
        const membership = await this.prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId: orgId,
                },
            },
        });
        return (membership?.role as MembershipRole) ?? null;
    }

    private async findMembership(orgId: string, userId: string) {
        const membership = await this.prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId: orgId,
                },
            },
        });

        if (!membership) {
            throw new NotFoundException('Membership not found');
        }

        return membership;
    }
}
