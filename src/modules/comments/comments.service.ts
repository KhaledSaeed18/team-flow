import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCommentDto, UpdateCommentDto } from './dto';
import { CommentEntity } from './entities';
import { NotificationsService } from '../notifications/notifications.service';

const authorSelect = {
    id: true,
    name: true,
    email: true,
    avatarUrl: true,
} as const;

@Injectable()
export class CommentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationsService: NotificationsService,
    ) {}

    async findAll(taskId: string) {
        await this.ensureTaskExists(taskId);

        // Fetch top-level comments with one level of replies (threaded)
        const comments = await this.prisma.comment.findMany({
            where: { taskId, parentId: null, deletedAt: null },
            include: {
                author: { select: authorSelect },
                replies: {
                    where: { deletedAt: null },
                    include: {
                        author: { select: authorSelect },
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        return comments.map((c) => this.toEntity(c));
    }

    async create(taskId: string, userId: string, dto: CreateCommentDto) {
        await this.ensureTaskExists(taskId);

        if (dto.parentId) {
            const parent = await this.prisma.comment.findFirst({
                where: { id: dto.parentId, taskId, deletedAt: null },
            });
            if (!parent) {
                throw new BadRequestException('Parent comment not found');
            }
        }

        const comment = await this.prisma.comment.create({
            data: {
                body: dto.body,
                taskId,
                authorId: userId,
                parentId: dto.parentId ?? null,
            },
            include: {
                author: { select: authorSelect },
            },
        });

        // Notify task watchers about the new comment (fire-and-forget)
        const watchers = await this.prisma.taskWatcher.findMany({
            where: { taskId },
            select: { userId: true },
        });
        const watcherIds = watchers
            .map((w) => w.userId)
            .filter((id) => id !== userId);

        if (watcherIds.length > 0) {
            const task = await this.prisma.task.findUnique({
                where: { id: taskId },
                select: { number: true, title: true },
            });
            this.notificationsService
                .createAndEmitMany(watcherIds, {
                    type: 'TASK_COMMENTED' as const,
                    title: `New comment on task #${task?.number ?? ''}`,
                    body: `${dto.body.substring(0, 100)}`,
                    resourceType: 'Task',
                    resourceId: taskId,
                })
                .catch(() => {});
        }

        return new CommentEntity(comment);
    }

    async update(
        taskId: string,
        commentId: string,
        userId: string,
        dto: UpdateCommentDto,
    ) {
        const comment = await this.findCommentOrFail(taskId, commentId);

        if (comment.authorId !== userId) {
            throw new ForbiddenException('You can only edit your own comments');
        }

        const updated = await this.prisma.comment.update({
            where: { id: commentId },
            data: {
                body: dto.body,
                isEdited: true,
            },
            include: {
                author: { select: authorSelect },
            },
        });

        return new CommentEntity(updated);
    }

    async softDelete(
        taskId: string,
        commentId: string,
        userId: string,
        userRole: string,
    ) {
        const comment = await this.findCommentOrFail(taskId, commentId);

        // Author or ADMIN+ can delete
        const isAdmin = ['OWNER', 'ADMIN'].includes(userRole);
        if (comment.authorId !== userId && !isAdmin) {
            throw new ForbiddenException(
                'You can only delete your own comments or be an admin',
            );
        }

        await this.prisma.comment.update({
            where: { id: commentId },
            data: { deletedAt: new Date() },
        });
    }

    // ── PRIVATE HELPERS ─────────────────────────────────────────────────

    private async ensureTaskExists(taskId: string) {
        const task = await this.prisma.task.findFirst({
            where: { id: taskId, deletedAt: null },
        });
        if (!task) throw new NotFoundException('Task not found');
        return task;
    }

    private async findCommentOrFail(taskId: string, commentId: string) {
        const comment = await this.prisma.comment.findFirst({
            where: { id: commentId, taskId, deletedAt: null },
        });
        if (!comment) throw new NotFoundException('Comment not found');
        return comment;
    }

    private toEntity(comment: any): CommentEntity {
        const entity = new CommentEntity(comment);
        if (comment.replies) {
            entity.replies = comment.replies.map(
                (r: any) => new CommentEntity(r),
            );
        }
        return entity;
    }
}
