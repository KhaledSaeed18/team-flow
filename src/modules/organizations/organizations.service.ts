import {
    Injectable,
    ConflictException,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
    CreateOrganizationDto,
    UpdateOrganizationDto,
    TransferOwnershipDto,
} from './dto';
import { OrganizationEntity } from './entities';

@Injectable()
export class OrganizationsService {
    constructor(private readonly prisma: PrismaService) {}

    async create(userId: string, dto: CreateOrganizationDto) {
        const existing = await this.prisma.organization.findUnique({
            where: { slug: dto.slug },
        });
        if (existing) {
            throw new ConflictException('Organization slug already taken');
        }

        const org = await this.prisma.$transaction(async (tx) => {
            const organization = await tx.organization.create({
                data: {
                    name: dto.name,
                    slug: dto.slug,
                    description: dto.description,
                    logoUrl: dto.logoUrl,
                    website: dto.website,
                    ownerId: userId,
                },
            });

            // Auto-create OWNER membership
            await tx.membership.create({
                data: {
                    userId,
                    organizationId: organization.id,
                    role: 'OWNER',
                },
            });

            return organization;
        });

        return new OrganizationEntity(org);
    }

    async findAllForUser(userId: string) {
        const memberships = await this.prisma.membership.findMany({
            where: { userId },
            include: {
                organization: true,
            },
        });

        return memberships
            .filter((m) => !m.organization.deletedAt)
            .map((m) => new OrganizationEntity(m.organization));
    }

    async findOne(orgId: string) {
        const org = await this.prisma.organization.findUnique({
            where: { id: orgId, deletedAt: null },
        });
        if (!org) {
            throw new NotFoundException('Organization not found');
        }
        return new OrganizationEntity(org);
    }

    async update(orgId: string, dto: UpdateOrganizationDto) {
        await this.ensureOrgExists(orgId);

        const org = await this.prisma.organization.update({
            where: { id: orgId },
            data: dto,
        });

        return new OrganizationEntity(org);
    }

    async softDelete(orgId: string, userId: string) {
        const org = await this.ensureOrgExists(orgId);

        if (org.ownerId !== userId) {
            throw new ForbiddenException(
                'Only the owner can delete the organization',
            );
        }

        const updated = await this.prisma.organization.update({
            where: { id: orgId },
            data: { deletedAt: new Date() },
        });

        return new OrganizationEntity(updated);
    }

    async transferOwnership(
        orgId: string,
        currentUserId: string,
        dto: TransferOwnershipDto,
    ) {
        const org = await this.ensureOrgExists(orgId);

        if (org.ownerId !== currentUserId) {
            throw new ForbiddenException(
                'Only the owner can transfer ownership',
            );
        }

        if (dto.newOwnerId === currentUserId) {
            throw new BadRequestException('You are already the owner');
        }

        // Verify the new owner is a member
        const newOwnerMembership = await this.prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: dto.newOwnerId,
                    organizationId: orgId,
                },
            },
        });

        if (!newOwnerMembership) {
            throw new BadRequestException(
                'New owner must be a member of this organization',
            );
        }

        const updated = await this.prisma.$transaction(async (tx) => {
            // Update org owner
            const updatedOrg = await tx.organization.update({
                where: { id: orgId },
                data: { ownerId: dto.newOwnerId },
            });

            // Promote new owner to OWNER role
            await tx.membership.update({
                where: { id: newOwnerMembership.id },
                data: { role: 'OWNER' },
            });

            // Demote previous owner to ADMIN
            await tx.membership.update({
                where: {
                    userId_organizationId: {
                        userId: currentUserId,
                        organizationId: orgId,
                    },
                },
                data: { role: 'ADMIN' },
            });

            return updatedOrg;
        });

        return new OrganizationEntity(updated);
    }

    private async ensureOrgExists(orgId: string) {
        const org = await this.prisma.organization.findUnique({
            where: { id: orgId, deletedAt: null },
        });
        if (!org) {
            throw new NotFoundException('Organization not found');
        }
        return org;
    }
}
