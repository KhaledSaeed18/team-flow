import {
    Injectable,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateLabelDto, UpdateLabelDto } from './dto';
import { LabelEntity } from './entities';

const creatorSelect = { id: true, name: true, email: true } as const;

@Injectable()
export class LabelsService {
    constructor(private readonly prisma: PrismaService) {}

    // ── ORG LABELS ──────────────────────────────────────────────────────

    async findOrgLabels(orgId: string) {
        const labels = await this.prisma.label.findMany({
            where: { organizationId: orgId, projectId: null },
            include: {
                createdBy: { select: creatorSelect },
                _count: { select: { tasks: true } },
            },
            orderBy: { name: 'asc' },
        });

        return labels.map((l) => new LabelEntity(l));
    }

    async createOrgLabel(orgId: string, userId: string, dto: CreateLabelDto) {
        await this.checkDuplicateLabel(dto.name, orgId, null);

        const label = await this.prisma.label.create({
            data: {
                name: dto.name,
                color: dto.color,
                organizationId: orgId,
                projectId: null,
                createdById: userId,
            },
            include: {
                createdBy: { select: creatorSelect },
                _count: { select: { tasks: true } },
            },
        });

        return new LabelEntity(label);
    }

    // ── PROJECT LABELS ──────────────────────────────────────────────────

    async findProjectLabels(projectId: string) {
        await this.ensureProjectExists(projectId);

        const labels = await this.prisma.label.findMany({
            where: { projectId },
            include: {
                createdBy: { select: creatorSelect },
                _count: { select: { tasks: true } },
            },
            orderBy: { name: 'asc' },
        });

        return labels.map((l) => new LabelEntity(l));
    }

    async createProjectLabel(
        projectId: string,
        userId: string,
        dto: CreateLabelDto,
    ) {
        const project = await this.ensureProjectExists(projectId);
        await this.checkDuplicateLabel(
            dto.name,
            project.organizationId,
            projectId,
        );

        const label = await this.prisma.label.create({
            data: {
                name: dto.name,
                color: dto.color,
                organizationId: project.organizationId,
                projectId,
                createdById: userId,
            },
            include: {
                createdBy: { select: creatorSelect },
                _count: { select: { tasks: true } },
            },
        });

        return new LabelEntity(label);
    }

    // ── UPDATE / DELETE ─────────────────────────────────────────────────

    async update(labelId: string, dto: UpdateLabelDto) {
        const label = await this.findLabelOrFail(labelId);

        if (dto.name && dto.name !== label.name) {
            await this.checkDuplicateLabel(
                dto.name,
                label.organizationId,
                label.projectId,
            );
        }

        const updated = await this.prisma.label.update({
            where: { id: labelId },
            data: dto,
            include: {
                createdBy: { select: creatorSelect },
                _count: { select: { tasks: true } },
            },
        });

        return new LabelEntity(updated);
    }

    async remove(labelId: string) {
        await this.findLabelOrFail(labelId);
        await this.prisma.label.delete({ where: { id: labelId } });
    }

    // ── TASK LABELING ───────────────────────────────────────────────────

    async tagTask(taskId: string, labelId: string) {
        await this.ensureTaskExists(taskId);
        await this.findLabelOrFail(labelId);

        const existing = await this.prisma.taskLabel.findUnique({
            where: { taskId_labelId: { taskId, labelId } },
        });

        if (existing) {
            throw new ConflictException('This label is already on the task');
        }

        await this.prisma.taskLabel.create({
            data: { taskId, labelId },
        });
    }

    async untagTask(taskId: string, labelId: string) {
        await this.ensureTaskExists(taskId);

        const existing = await this.prisma.taskLabel.findUnique({
            where: { taskId_labelId: { taskId, labelId } },
        });

        if (!existing) {
            throw new NotFoundException('This label is not on the task');
        }

        await this.prisma.taskLabel.delete({
            where: { taskId_labelId: { taskId, labelId } },
        });
    }

    // ── HELPERS ─────────────────────────────────────────────────────────

    /** Returns the label's orgId so guards can resolve org context */
    async getLabelOrgId(labelId: string): Promise<string> {
        const label = await this.prisma.label.findUnique({
            where: { id: labelId },
            select: { organizationId: true },
        });
        if (!label) throw new NotFoundException('Label not found');
        return label.organizationId;
    }

    private async findLabelOrFail(labelId: string) {
        const label = await this.prisma.label.findUnique({
            where: { id: labelId },
        });
        if (!label) throw new NotFoundException('Label not found');
        return label;
    }

    private async ensureProjectExists(projectId: string) {
        const project = await this.prisma.project.findFirst({
            where: { id: projectId, deletedAt: null },
        });
        if (!project) throw new NotFoundException('Project not found');
        return project;
    }

    private async ensureTaskExists(taskId: string) {
        const task = await this.prisma.task.findFirst({
            where: { id: taskId, deletedAt: null },
        });
        if (!task) throw new NotFoundException('Task not found');
        return task;
    }

    private async checkDuplicateLabel(
        name: string,
        organizationId: string,
        projectId: string | null,
    ) {
        const existing = await this.prisma.label.findFirst({
            where: { name, organizationId, projectId },
        });
        if (existing) {
            throw new ConflictException(
                `A label named "${name}" already exists in this scope`,
            );
        }
    }
}
