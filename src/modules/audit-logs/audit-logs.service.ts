import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction } from '../../generated/prisma/enums';
import { QueryAuditLogsDto } from './dto';
import { AuditLogEntity } from './entities';

export interface CreateAuditLogInput {
    actorId?: string | null;
    organizationId?: string | null;
    projectId?: string | null;
    action: AuditAction;
    entity: string;
    entityId: string;
    before?: any;
    after?: any;
    ipAddress?: string | null;
    userAgent?: string | null;
}

const actorSelect = {
    id: true,
    name: true,
    email: true,
} as const;

@Injectable()
export class AuditLogsService {
    private readonly logger = new Logger(AuditLogsService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Query audit logs with filters and pagination.
     * Read-only — used by the controller.
     */
    async findAll(orgId: string, dto: QueryAuditLogsDto) {
        const {
            actorId,
            organizationId,
            projectId,
            action,
            entity,
            entityId,
            from,
            to,
            page = 1,
            limit = 25,
        } = dto;

        const where: any = {
            // Always scoped to the org
            organizationId: organizationId ?? orgId,
        };

        if (actorId) where.actorId = actorId;
        if (projectId) where.projectId = projectId;
        if (action) where.action = action;
        if (entity) where.entity = entity;
        if (entityId) where.entityId = entityId;

        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(from);
            if (to) where.createdAt.lte = new Date(to);
        }

        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            this.prisma.auditLog.findMany({
                where,
                include: { actor: { select: actorSelect } },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip,
            }),
            this.prisma.auditLog.count({ where }),
        ]);

        return {
            items: items.map((item) => new AuditLogEntity(item)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Append an immutable audit log entry.
     * Called ONLY by the AuditLogInterceptor — never from service code directly.
     */
    async log(input: CreateAuditLogInput): Promise<void> {
        try {
            await this.prisma.auditLog.create({
                data: {
                    actorId: input.actorId ?? null,
                    organizationId: input.organizationId ?? null,
                    projectId: input.projectId ?? null,
                    action: input.action,
                    entity: input.entity,
                    entityId: input.entityId,
                    before: input.before ?? undefined,
                    after: input.after ?? undefined,
                    ipAddress: input.ipAddress ?? null,
                    userAgent: input.userAgent ?? null,
                },
            });
        } catch (error) {
            // Audit logging must never break the request flow
            this.logger.error('Failed to write audit log', error);
        }
    }
}
