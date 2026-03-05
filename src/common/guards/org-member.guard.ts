import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class OrgMemberGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request['user'] as JwtPayload | undefined;
        if (!user) throw new ForbiddenException('Authentication required');

        // SUPER_ADMIN bypasses membership check
        if (user.globalRole === 'SUPER_ADMIN') return true;

        const orgId = await this.resolveOrgId(request);
        if (!orgId) {
            throw new ForbiddenException('Organization context required');
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

        request['membership'] = membership;

        return true;
    }

    private async resolveOrgId(request: any): Promise<string | undefined> {
        const orgId =
            (request.params?.orgId as string) || (request.params?.id as string);
        if (orgId) return orgId;

        // Resolve org via project for routes like /projects/:projectId/*
        const projectId = request.params?.projectId as string | undefined;
        if (projectId) {
            const project = await this.prisma.project.findFirst({
                where: { id: projectId, deletedAt: null },
                select: { organizationId: true },
            });
            if (!project) throw new NotFoundException('Project not found');
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
            request['taskOrgId'] = task.organizationId;
            request['taskProjectId'] = task.projectId;
            return task.organizationId;
        }

        return undefined;
    }
}
