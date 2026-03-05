import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MembershipRole } from '../../generated/prisma/enums';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../../database/prisma.service';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly prisma: PrismaService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredRoles = this.reflector.getAllAndOverride<
            MembershipRole[] | undefined
        >(ROLES_KEY, [context.getHandler(), context.getClass()]);

        if (!requiredRoles || requiredRoles.length === 0) return true;

        const request = context.switchToHttp().getRequest();
        const user = request['user'] as JwtPayload | undefined;
        if (!user) throw new ForbiddenException('Authentication required');

        // SUPER_ADMIN bypasses all role checks
        if (user.globalRole === 'SUPER_ADMIN') return true;

        const orgId = await this.resolveOrgId(request);
        if (!orgId) {
            throw new ForbiddenException(
                'Organization context required for role check',
            );
        }

        const membership = await this.prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: user.sub,
                    organizationId: orgId,
                },
            },
        });

        if (!membership) {
            throw new ForbiddenException(
                'You are not a member of this organization',
            );
        }

        const roleHierarchy: Record<MembershipRole, number> = {
            OWNER: 4,
            ADMIN: 3,
            MEMBER: 2,
            VIEWER: 1,
        };

        const userLevel = roleHierarchy[membership.role];
        const minRequired = Math.min(
            ...requiredRoles.map((r) => roleHierarchy[r]),
        );

        if (userLevel < minRequired) {
            throw new ForbiddenException('Insufficient role');
        }

        // Attach membership to request for downstream use
        request['membership'] = membership;

        return true;
    }

    private async resolveOrgId(request: any): Promise<string | undefined> {
        const orgId = request.params?.orgId as string | undefined;
        if (orgId) return orgId;

        // Resolve org via project for routes like /projects/:projectId/*
        const projectId = request.params?.projectId as string | undefined;
        if (projectId) {
            const project = await this.prisma.project.findFirst({
                where: { id: projectId, deletedAt: null },
                select: { organizationId: true },
            });
            if (!project) throw new NotFoundException('Project not found');
            // Verify org is not soft-deleted
            const org = await this.prisma.organization.findFirst({
                where: { id: project.organizationId, deletedAt: null },
                select: { id: true },
            });
            if (!org) throw new NotFoundException('Organization not found');
            request['projectOrgId'] = project.organizationId;
            return project.organizationId;
        }

        // Resolve org via task for routes like /tasks/:taskId/*
        const taskId = request.params?.taskId as string | undefined;
        if (taskId) {
            const task = await this.prisma.task.findFirst({
                where: { id: taskId, deletedAt: null },
                select: { organizationId: true, projectId: true },
            });
            if (!task) throw new NotFoundException('Task not found');
            const org = await this.prisma.organization.findFirst({
                where: { id: task.organizationId, deletedAt: null },
                select: { id: true },
            });
            if (!org) throw new NotFoundException('Organization not found');
            request['taskOrgId'] = task.organizationId;
            request['taskProjectId'] = task.projectId;
            return task.organizationId;
        }

        // Generic :id param — could be an org ID or a label ID
        const id = request.params?.id as string | undefined;
        if (id) {
            // Check if it's an org ID
            const org = await this.prisma.organization.findFirst({
                where: { id, deletedAt: null },
                select: { id: true },
            });
            if (org) return id;

            // Check if it's a label ID
            const label = await this.prisma.label.findUnique({
                where: { id },
                select: { organizationId: true },
            });
            if (label) {
                request['labelOrgId'] = label.organizationId;
                return label.organizationId;
            }
        }

        return undefined;
    }
}
