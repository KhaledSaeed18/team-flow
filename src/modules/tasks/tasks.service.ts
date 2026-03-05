import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
    CreateTaskDto,
    UpdateTaskDto,
    AssignTaskDto,
    MoveTaskToSprintDto,
    AddDependencyDto,
    QueryTasksDto,
} from './dto';
import {
    TaskEntity,
    TaskDependencyEntity,
    TaskActivityEntity,
} from './entities';

// Shared select for user relations
const userSelect = {
    id: true,
    name: true,
    email: true,
    avatarUrl: true,
} as const;

@Injectable()
export class TasksService {
    constructor(private readonly prisma: PrismaService) {}

    // ── CRUD ────────────────────────────────────────────────────────────

    async create(projectId: string, userId: string, dto: CreateTaskDto) {
        const project = await this.ensureProjectActive(projectId);

        // Validate sprint belongs to this project
        if (dto.sprintId) {
            await this.ensureSprintBelongsToProject(dto.sprintId, projectId);
        }

        // Validate parent task belongs to this project
        if (dto.parentTaskId) {
            await this.ensureTaskBelongsToProject(dto.parentTaskId, projectId);
        }

        // Validate assignee is an org member
        if (dto.assignedToId) {
            await this.ensureOrgMember(
                dto.assignedToId,
                project.organizationId,
            );
        }

        const task = await this.prisma.$transaction(async (tx) => {
            // Auto-increment task number within the project (inside tx to reduce race window)
            const lastTask = await tx.task.findFirst({
                where: { projectId },
                orderBy: { number: 'desc' },
                select: { number: true },
            });
            const nextNumber = (lastTask?.number ?? 0) + 1;

            const created = await tx.task.create({
                data: {
                    number: nextNumber,
                    title: dto.title,
                    description: dto.description,
                    priority: (dto.priority as any) ?? 'MEDIUM',
                    storyPoints: dto.storyPoints,
                    dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
                    organizationId: project.organizationId,
                    projectId,
                    sprintId: dto.sprintId ?? null,
                    parentTaskId: dto.parentTaskId ?? null,
                    assignedToId: dto.assignedToId ?? null,
                    createdById: userId,
                },
                include: {
                    createdBy: { select: userSelect },
                    assignedTo: { select: userSelect },
                },
            });

            // Auto-watch creator
            await tx.taskWatcher.create({
                data: { taskId: created.id, userId },
            });

            // Auto-watch assignee if different from creator
            if (dto.assignedToId && dto.assignedToId !== userId) {
                await tx.taskWatcher.create({
                    data: { taskId: created.id, userId: dto.assignedToId },
                });
            }

            // Log creation activity
            await tx.taskActivity.create({
                data: {
                    taskId: created.id,
                    actorId: userId,
                    action: 'created task',
                    field: null,
                    oldValue: null,
                    newValue: null,
                },
            });

            return created;
        });

        return new TaskEntity(task);
    }

    async findAll(projectId: string, query: QueryTasksDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const where: any = {
            projectId,
            deletedAt: null,
        };

        if (query.status) where.status = query.status;
        if (query.priority) where.priority = query.priority;
        if (query.assignedToId) where.assignedToId = query.assignedToId;
        if (query.sprintId) where.sprintId = query.sprintId;
        if (query.parentTaskId) where.parentTaskId = query.parentTaskId;

        const [tasks, total] = await Promise.all([
            this.prisma.task.findMany({
                where,
                include: {
                    createdBy: { select: userSelect },
                    assignedTo: { select: userSelect },
                    _count: {
                        select: {
                            subTasks: true,
                            comments: true,
                            attachments: true,
                            watchers: true,
                        },
                    },
                },
                orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
                skip,
                take: limit,
            }),
            this.prisma.task.count({ where }),
        ]);

        return {
            data: tasks.map((t) => new TaskEntity(t)),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findBacklog(projectId: string) {
        const tasks = await this.prisma.task.findMany({
            where: { projectId, sprintId: null, deletedAt: null },
            include: {
                createdBy: { select: userSelect },
                assignedTo: { select: userSelect },
                _count: {
                    select: {
                        subTasks: true,
                        comments: true,
                        attachments: true,
                        watchers: true,
                    },
                },
            },
            orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        });

        return tasks.map((t) => new TaskEntity(t));
    }

    async findOne(projectId: string, taskId: string) {
        const task = await this.prisma.task.findFirst({
            where: { id: taskId, projectId, deletedAt: null },
            include: {
                createdBy: { select: userSelect },
                assignedTo: { select: userSelect },
                subTasks: {
                    where: { deletedAt: null },
                    select: {
                        id: true,
                        number: true,
                        title: true,
                        status: true,
                        priority: true,
                        assignedToId: true,
                    },
                },
                dependencies: {
                    include: {
                        dependencyTask: {
                            select: {
                                id: true,
                                number: true,
                                title: true,
                                status: true,
                            },
                        },
                    },
                },
                dependents: {
                    include: {
                        dependentTask: {
                            select: {
                                id: true,
                                number: true,
                                title: true,
                                status: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        subTasks: true,
                        comments: true,
                        attachments: true,
                        watchers: true,
                    },
                },
            },
        });

        if (!task) throw new NotFoundException('Task not found');

        return new TaskEntity(task);
    }

    async update(
        projectId: string,
        taskId: string,
        userId: string,
        dto: UpdateTaskDto,
    ) {
        const existing = await this.ensureTaskExists(projectId, taskId);

        // Validate parent task if changing
        if (dto.parentTaskId !== undefined) {
            if (dto.parentTaskId === taskId) {
                throw new BadRequestException(
                    'A task cannot be its own parent',
                );
            }
            if (dto.parentTaskId) {
                await this.ensureTaskBelongsToProject(
                    dto.parentTaskId,
                    projectId,
                );
            }
        }

        // Handle status change → auto-set completedAt
        const data: any = { ...dto };
        if (dto.dueDate !== undefined) {
            data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
        }
        if (dto.status === 'DONE' && existing.status !== 'DONE') {
            data.completedAt = new Date();
        } else if (
            dto.status &&
            dto.status !== 'DONE' &&
            existing.completedAt
        ) {
            data.completedAt = null;
        }

        const task = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.task.update({
                where: { id: taskId },
                data,
                include: {
                    createdBy: { select: userSelect },
                    assignedTo: { select: userSelect },
                },
            });

            // Log activity for each changed field
            const activities = this.buildActivityRecords(
                taskId,
                userId,
                existing,
                dto,
            );
            if (activities.length > 0) {
                await tx.taskActivity.createMany({ data: activities });
            }

            return updated;
        });

        return new TaskEntity(task);
    }

    async softDelete(projectId: string, taskId: string, userId: string) {
        await this.ensureTaskExists(projectId, taskId);

        const task = await this.prisma.$transaction(async (tx) => {
            const deleted = await tx.task.update({
                where: { id: taskId },
                data: { deletedAt: new Date() },
            });

            await tx.taskActivity.create({
                data: {
                    taskId,
                    actorId: userId,
                    action: 'soft-deleted task',
                },
            });

            return deleted;
        });

        return new TaskEntity(task);
    }

    async restore(projectId: string, taskId: string, userId: string) {
        const task = await this.prisma.task.findFirst({
            where: { id: taskId, projectId },
        });

        if (!task) throw new NotFoundException('Task not found');
        if (!task.deletedAt) {
            throw new BadRequestException('Task is not deleted');
        }

        const restored = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.task.update({
                where: { id: taskId },
                data: { deletedAt: null },
            });

            await tx.taskActivity.create({
                data: {
                    taskId,
                    actorId: userId,
                    action: 'restored task',
                },
            });

            return updated;
        });

        return new TaskEntity(restored);
    }

    // ── ASSIGN ──────────────────────────────────────────────────────────

    async assign(
        projectId: string,
        taskId: string,
        userId: string,
        dto: AssignTaskDto,
    ) {
        const existing = await this.ensureTaskExists(projectId, taskId);
        const project = await this.ensureProjectActive(projectId);

        if (dto.assignedToId) {
            await this.ensureOrgMember(
                dto.assignedToId,
                project.organizationId,
            );
        }

        const task = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.task.update({
                where: { id: taskId },
                data: { assignedToId: dto.assignedToId },
                include: {
                    createdBy: { select: userSelect },
                    assignedTo: { select: userSelect },
                },
            });

            // Auto-watch new assignee
            if (dto.assignedToId) {
                await tx.taskWatcher.upsert({
                    where: {
                        taskId_userId: { taskId, userId: dto.assignedToId },
                    },
                    create: { taskId, userId: dto.assignedToId },
                    update: {},
                });
            }

            // Log activity
            await tx.taskActivity.create({
                data: {
                    taskId,
                    actorId: userId,
                    action: dto.assignedToId
                        ? 'assigned task'
                        : 'unassigned task',
                    field: 'assignedToId',
                    oldValue: existing.assignedToId,
                    newValue: dto.assignedToId,
                },
            });

            return updated;
        });

        return new TaskEntity(task);
    }

    // ── SPRINT MOVE ─────────────────────────────────────────────────────

    async moveToSprint(
        projectId: string,
        taskId: string,
        userId: string,
        dto: MoveTaskToSprintDto,
    ) {
        const existing = await this.ensureTaskExists(projectId, taskId);

        if (dto.sprintId) {
            await this.ensureSprintBelongsToProject(dto.sprintId, projectId);
        }

        const task = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.task.update({
                where: { id: taskId },
                data: { sprintId: dto.sprintId },
                include: {
                    createdBy: { select: userSelect },
                    assignedTo: { select: userSelect },
                },
            });

            await tx.taskActivity.create({
                data: {
                    taskId,
                    actorId: userId,
                    action: dto.sprintId
                        ? 'moved task to sprint'
                        : 'moved task to backlog',
                    field: 'sprintId',
                    oldValue: existing.sprintId,
                    newValue: dto.sprintId,
                },
            });

            return updated;
        });

        return new TaskEntity(task);
    }

    // ── WATCHERS ────────────────────────────────────────────────────────

    async watch(projectId: string, taskId: string, userId: string) {
        await this.ensureTaskExists(projectId, taskId);

        const existing = await this.prisma.taskWatcher.findUnique({
            where: { taskId_userId: { taskId, userId } },
        });

        if (existing) {
            throw new ConflictException('You are already watching this task');
        }

        await this.prisma.taskWatcher.create({
            data: { taskId, userId },
        });
    }

    async unwatch(projectId: string, taskId: string, userId: string) {
        await this.ensureTaskExists(projectId, taskId);

        const existing = await this.prisma.taskWatcher.findUnique({
            where: { taskId_userId: { taskId, userId } },
        });

        if (!existing) {
            throw new NotFoundException('You are not watching this task');
        }

        await this.prisma.taskWatcher.delete({
            where: { id: existing.id },
        });
    }

    // ── DEPENDENCIES ────────────────────────────────────────────────────

    async addDependency(
        projectId: string,
        taskId: string,
        userId: string,
        dto: AddDependencyDto,
    ) {
        await this.ensureTaskExists(projectId, taskId);
        await this.ensureTaskBelongsToProject(dto.dependencyTaskId, projectId);

        if (dto.dependencyTaskId === taskId) {
            throw new BadRequestException('A task cannot depend on itself');
        }

        // Check for existing dependency
        const existing = await this.prisma.taskDependency.findUnique({
            where: {
                dependentTaskId_dependencyTaskId: {
                    dependentTaskId: taskId,
                    dependencyTaskId: dto.dependencyTaskId,
                },
            },
        });

        if (existing) {
            throw new ConflictException('This dependency already exists');
        }

        // Circular dependency check via BFS
        await this.checkCircularDependency(taskId, dto.dependencyTaskId);

        const dependency = await this.prisma.$transaction(async (tx) => {
            const dep = await tx.taskDependency.create({
                data: {
                    dependentTaskId: taskId,
                    dependencyTaskId: dto.dependencyTaskId,
                },
                include: {
                    dependencyTask: {
                        select: {
                            id: true,
                            number: true,
                            title: true,
                            status: true,
                        },
                    },
                },
            });

            await tx.taskActivity.create({
                data: {
                    taskId,
                    actorId: userId,
                    action: 'added dependency',
                    field: 'dependencies',
                    newValue: dto.dependencyTaskId,
                },
            });

            return dep;
        });

        return new TaskDependencyEntity(dependency);
    }

    async removeDependency(
        projectId: string,
        taskId: string,
        depId: string,
        userId: string,
    ) {
        await this.ensureTaskExists(projectId, taskId);

        const dependency = await this.prisma.taskDependency.findFirst({
            where: { id: depId, dependentTaskId: taskId },
        });

        if (!dependency) {
            throw new NotFoundException('Dependency not found');
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.taskDependency.delete({ where: { id: depId } });

            await tx.taskActivity.create({
                data: {
                    taskId,
                    actorId: userId,
                    action: 'removed dependency',
                    field: 'dependencies',
                    oldValue: dependency.dependencyTaskId,
                },
            });
        });
    }

    // ── ACTIVITIES ──────────────────────────────────────────────────────

    async getActivities(projectId: string, taskId: string) {
        await this.ensureTaskExists(projectId, taskId);

        const activities = await this.prisma.taskActivity.findMany({
            where: { taskId },
            include: {
                actor: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return activities.map((a) => new TaskActivityEntity(a));
    }

    // ── PRIVATE HELPERS ─────────────────────────────────────────────────

    private async ensureTaskExists(projectId: string, taskId: string) {
        const task = await this.prisma.task.findFirst({
            where: { id: taskId, projectId, deletedAt: null },
        });

        if (!task) throw new NotFoundException('Task not found');
        return task;
    }

    private async ensureProjectActive(projectId: string) {
        const project = await this.prisma.project.findFirst({
            where: { id: projectId, deletedAt: null },
        });

        if (!project) throw new NotFoundException('Project not found');

        if (project.status === 'ARCHIVED') {
            throw new BadRequestException(
                'Cannot modify tasks in an archived project',
            );
        }

        return project;
    }

    private async ensureSprintBelongsToProject(
        sprintId: string,
        projectId: string,
    ) {
        const sprint = await this.prisma.sprint.findFirst({
            where: { id: sprintId, projectId },
        });

        if (!sprint) {
            throw new BadRequestException(
                'Sprint does not belong to this project',
            );
        }

        return sprint;
    }

    private async ensureTaskBelongsToProject(
        taskId: string,
        projectId: string,
    ) {
        const task = await this.prisma.task.findFirst({
            where: { id: taskId, projectId, deletedAt: null },
        });

        if (!task) {
            throw new BadRequestException(
                'Referenced task does not belong to this project',
            );
        }

        return task;
    }

    private async ensureOrgMember(userId: string, organizationId: string) {
        const membership = await this.prisma.membership.findUnique({
            where: {
                userId_organizationId: { userId, organizationId },
            },
        });

        if (!membership) {
            throw new BadRequestException(
                'User is not a member of this organization',
            );
        }
    }

    /**
     * BFS circular dependency check.
     * If we're adding: dependentTaskId (taskId) depends on dependencyTaskId,
     * check that dependencyTaskId doesn't already transitively depend on taskId.
     */
    private async checkCircularDependency(
        dependentTaskId: string,
        dependencyTaskId: string,
    ) {
        const maxDepth = 50;
        const visited = new Set<string>();
        const queue = [dependencyTaskId];

        while (queue.length > 0) {
            if (visited.size >= maxDepth) {
                throw new BadRequestException(
                    'Dependency chain is too deep to validate',
                );
            }

            const current = queue.shift()!;
            if (current === dependentTaskId) {
                throw new BadRequestException(
                    'Adding this dependency would create a circular reference',
                );
            }

            if (visited.has(current)) continue;
            visited.add(current);

            // Find all tasks that `current` depends on
            const deps = await this.prisma.taskDependency.findMany({
                where: { dependentTaskId: current },
                select: { dependencyTaskId: true },
            });

            for (const dep of deps) {
                if (!visited.has(dep.dependencyTaskId)) {
                    queue.push(dep.dependencyTaskId);
                }
            }
        }
    }

    /**
     * Build activity records for changed fields during update.
     */
    private buildActivityRecords(
        taskId: string,
        actorId: string,
        existing: Record<string, any>,
        dto: UpdateTaskDto,
    ) {
        const activities: Array<{
            taskId: string;
            actorId: string;
            action: string;
            field: string;
            oldValue: string | null;
            newValue: string | null;
        }> = [];

        const trackedFields: Array<{
            key: keyof UpdateTaskDto;
            label: string;
        }> = [
            { key: 'title', label: 'title' },
            { key: 'description', label: 'description' },
            { key: 'priority', label: 'priority' },
            { key: 'status', label: 'status' },
            { key: 'storyPoints', label: 'story points' },
            { key: 'dueDate', label: 'due date' },
            { key: 'parentTaskId', label: 'parent task' },
        ];

        for (const { key, label } of trackedFields) {
            if (dto[key] !== undefined) {
                const oldVal = existing[key];
                const newVal = dto[key];

                // Only log if actually changed
                if (String(oldVal ?? '') !== String(newVal ?? '')) {
                    activities.push({
                        taskId,
                        actorId,
                        action: `changed ${label} from "${oldVal ?? 'none'}" to "${newVal ?? 'none'}"`,
                        field: key,
                        oldValue: oldVal != null ? String(oldVal) : null,
                        newValue: newVal != null ? String(newVal) : null,
                    });
                }
            }
        }

        return activities;
    }
}
