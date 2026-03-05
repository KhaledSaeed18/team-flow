import { Injectable, NotFoundException } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { PrismaService } from '../../database/prisma.service';
import type { CreateNotificationDto } from './dto';
import { QueryNotificationsDto } from './dto';
import { NotificationEntity } from './entities';

interface MessageEvent {
    data: string | object;
    id?: string;
    type?: string;
    retry?: number;
}

@Injectable()
export class NotificationsService {
    private readonly streams = new Map<string, Subject<MessageEvent>>();

    constructor(private readonly prisma: PrismaService) {}

    // ── Called by other services (fire-and-forget) ──────────────────────

    async createAndEmit(
        userId: string,
        dto: CreateNotificationDto,
    ): Promise<void> {
        const notification = await this.prisma.notification.create({
            data: {
                userId,
                type: dto.type,
                title: dto.title,
                body: dto.body ?? null,
                resourceType: dto.resourceType ?? null,
                resourceId: dto.resourceId ?? null,
                meta: dto.meta ?? {},
            },
        });

        this.emit(userId, new NotificationEntity(notification));
    }

    /**
     * Batch-create notifications for multiple users.
     * Used for fan-out to watchers/members.
     */
    async createAndEmitMany(
        userIds: string[],
        dto: CreateNotificationDto,
    ): Promise<void> {
        if (userIds.length === 0) return;

        // Bulk insert
        await this.prisma.notification.createMany({
            data: userIds.map((userId) => ({
                userId,
                type: dto.type,
                title: dto.title,
                body: dto.body ?? null,
                resourceType: dto.resourceType ?? null,
                resourceId: dto.resourceId ?? null,
                meta: dto.meta ?? {},
            })),
        });

        // Fetch created notifications for SSE emit (with proper IDs)
        const notifications = await this.prisma.notification.findMany({
            where: {
                userId: { in: userIds },
                type: dto.type,
                title: dto.title,
            },
            orderBy: { createdAt: 'desc' },
            take: userIds.length,
        });

        for (const notification of notifications) {
            this.emit(
                notification.userId,
                new NotificationEntity(notification),
            );
        }
    }

    // ── REST endpoints ──────────────────────────────────────────────────

    async findAll(userId: string, query: QueryNotificationsDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = { userId };
        if (query.isRead !== undefined) {
            where.isRead = query.isRead;
        }

        const [notifications, total] = await Promise.all([
            this.prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.notification.count({ where }),
        ]);

        return {
            data: notifications.map((n) => new NotificationEntity(n)),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async getUnreadCount(userId: string): Promise<{ count: number }> {
        const count = await this.prisma.notification.count({
            where: { userId, isRead: false },
        });
        return { count };
    }

    async markAsRead(userId: string, notificationId: string) {
        const notification = await this.prisma.notification.findFirst({
            where: { id: notificationId, userId },
        });

        if (!notification) {
            throw new NotFoundException('Notification not found');
        }

        const updated = await this.prisma.notification.update({
            where: { id: notificationId },
            data: { isRead: true, readAt: new Date() },
        });

        return new NotificationEntity(updated);
    }

    async markAllAsRead(userId: string) {
        const { count } = await this.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true, readAt: new Date() },
        });

        return { updated: count };
    }

    async remove(userId: string, notificationId: string) {
        const notification = await this.prisma.notification.findFirst({
            where: { id: notificationId, userId },
        });

        if (!notification) {
            throw new NotFoundException('Notification not found');
        }

        await this.prisma.notification.delete({
            where: { id: notificationId },
        });
    }

    // ── SSE stream ──────────────────────────────────────────────────────

    getStream(userId: string): Observable<MessageEvent> {
        if (!this.streams.has(userId)) {
            this.streams.set(userId, new Subject<MessageEvent>());
        }
        return this.streams.get(userId)!.asObservable();
    }

    private emit(userId: string, notification: NotificationEntity): void {
        this.streams.get(userId)?.next({ data: notification });
    }
}
