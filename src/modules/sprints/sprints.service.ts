import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateSprintDto, UpdateSprintDto } from './dto';
import { SprintEntity } from './entities';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SprintsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationsService: NotificationsService,
    ) {}

    async create(projectId: string, dto: CreateSprintDto) {
        await this.ensureProjectActive(projectId);

        // Auto-assign next order if not provided
        let order = dto.order;
        if (order === undefined) {
            const lastSprint = await this.prisma.sprint.findFirst({
                where: { projectId },
                orderBy: { order: 'desc' },
                select: { order: true },
            });
            order = (lastSprint?.order ?? -1) + 1;
        }

        const sprint = await this.prisma.sprint.create({
            data: {
                name: dto.name,
                goal: dto.goal,
                startDate: dto.startDate ? new Date(dto.startDate) : null,
                endDate: dto.endDate ? new Date(dto.endDate) : null,
                order,
                projectId,
            },
        });

        return new SprintEntity(sprint);
    }

    async findAll(projectId: string) {
        const sprints = await this.prisma.sprint.findMany({
            where: { projectId },
            orderBy: { order: 'asc' },
        });

        return sprints.map((s) => new SprintEntity(s));
    }

    async findOne(projectId: string, sprintId: string) {
        const sprint = await this.ensureSprintExists(projectId, sprintId);
        return new SprintEntity(sprint);
    }

    async update(projectId: string, sprintId: string, dto: UpdateSprintDto) {
        await this.ensureSprintExists(projectId, sprintId);

        const sprint = await this.prisma.sprint.update({
            where: { id: sprintId },
            data: {
                name: dto.name,
                goal: dto.goal,
                startDate: dto.startDate ? new Date(dto.startDate) : undefined,
                endDate: dto.endDate ? new Date(dto.endDate) : undefined,
                order: dto.order,
            },
        });

        return new SprintEntity(sprint);
    }

    /**
     * Start a sprint: PLANNED → ACTIVE.
     * Only one sprint should be ACTIVE per project at a time.
     */
    async start(projectId: string, sprintId: string) {
        await this.ensureProjectActive(projectId);
        const sprint = await this.ensureSprintExists(projectId, sprintId);

        if (sprint.status !== 'PLANNED') {
            throw new BadRequestException(
                `Cannot start sprint with status: ${sprint.status}. Only PLANNED sprints can be started.`,
            );
        }

        // Ensure no other ACTIVE sprint in this project
        const activeSprint = await this.prisma.sprint.findFirst({
            where: { projectId, status: 'ACTIVE' },
        });

        if (activeSprint) {
            throw new BadRequestException(
                `Project already has an active sprint: "${activeSprint.name}". Complete it before starting a new one.`,
            );
        }

        const updated = await this.prisma.sprint.update({
            where: { id: sprintId },
            data: {
                status: 'ACTIVE',
                startDate: sprint.startDate ?? new Date(),
            },
        });

        // Notify project org members about sprint start (fire-and-forget)
        this.notifyProjectMembers(projectId, {
            type: 'SPRINT_STARTED' as const,
            title: `Sprint "${sprint.name}" has started`,
            resourceType: 'Sprint',
            resourceId: sprintId,
        }).catch(() => {});

        return new SprintEntity(updated);
    }

    /**
     * Complete a sprint: ACTIVE → COMPLETED.
     * Tasks still in this sprint with status != DONE get their sprintId set to null (back to backlog).
     */
    async complete(projectId: string, sprintId: string) {
        const sprint = await this.ensureSprintExists(projectId, sprintId);

        if (sprint.status !== 'ACTIVE') {
            throw new BadRequestException(
                `Cannot complete sprint with status: ${sprint.status}. Only ACTIVE sprints can be completed.`,
            );
        }

        const [updatedSprint] = await this.prisma.$transaction([
            this.prisma.sprint.update({
                where: { id: sprintId },
                data: {
                    status: 'COMPLETED',
                    endDate: sprint.endDate ?? new Date(),
                },
            }),
            // Move incomplete tasks back to backlog
            this.prisma.task.updateMany({
                where: {
                    sprintId,
                    status: { not: 'DONE' },
                    deletedAt: null,
                },
                data: { sprintId: null },
            }),
        ]);

        // Notify project org members about sprint completion (fire-and-forget)
        this.notifyProjectMembers(projectId, {
            type: 'SPRINT_COMPLETED' as const,
            title: `Sprint "${sprint.name}" has been completed`,
            resourceType: 'Sprint',
            resourceId: sprintId,
        }).catch(() => {});

        return new SprintEntity(updatedSprint);
    }

    async remove(projectId: string, sprintId: string) {
        const sprint = await this.ensureSprintExists(projectId, sprintId);

        if (sprint.status === 'ACTIVE') {
            throw new BadRequestException(
                'Cannot delete an active sprint. Complete it first.',
            );
        }

        // Explicitly move tasks to backlog before deletion
        await this.prisma.$transaction([
            this.prisma.task.updateMany({
                where: { sprintId, deletedAt: null },
                data: { sprintId: null },
            }),
            this.prisma.sprint.delete({
                where: { id: sprintId },
            }),
        ]);
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    private async ensureSprintExists(projectId: string, sprintId: string) {
        const sprint = await this.prisma.sprint.findFirst({
            where: { id: sprintId, projectId },
        });

        if (!sprint) {
            throw new NotFoundException('Sprint not found');
        }

        return sprint;
    }

    private async ensureProjectActive(projectId: string) {
        const project = await this.prisma.project.findFirst({
            where: { id: projectId, deletedAt: null },
        });

        if (!project) {
            throw new NotFoundException('Project not found');
        }

        if (project.status === 'ARCHIVED') {
            throw new BadRequestException(
                'Cannot modify sprints in an archived project',
            );
        }

        return project;
    }

    private async notifyProjectMembers(
        projectId: string,
        dto: {
            type: 'SPRINT_STARTED' | 'SPRINT_COMPLETED';
            title: string;
            resourceType: string;
            resourceId: string;
        },
    ) {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            select: { organizationId: true },
        });
        if (!project) return;

        const members = await this.prisma.membership.findMany({
            where: { organizationId: project.organizationId },
            select: { userId: true },
        });

        await this.notificationsService.createAndEmitMany(
            members.map((m) => m.userId),
            dto,
        );
    }
}
