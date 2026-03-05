import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationEntity {
    @ApiProperty({ example: 'uuid-notification' })
    id: string;

    @ApiProperty({ example: 'uuid-user' })
    userId: string;

    @ApiProperty({
        enum: [
            'TASK_ASSIGNED',
            'TASK_UPDATED',
            'TASK_COMMENTED',
            'TASK_STATUS_CHANGED',
            'TASK_DUE_SOON',
            'TASK_OVERDUE',
            'SPRINT_STARTED',
            'SPRINT_COMPLETED',
            'PROJECT_ARCHIVED',
            'MEMBER_JOINED',
            'MEMBER_REMOVED',
            'MENTION',
        ],
        example: 'TASK_ASSIGNED',
    })
    type: string;

    @ApiProperty({ example: 'You were assigned to task #42' })
    title: string;

    @ApiPropertyOptional({
        example: 'Task "Fix login bug" was assigned to you',
    })
    body: string | null;

    @ApiProperty({ example: false })
    isRead: boolean;

    @ApiPropertyOptional({ example: '2025-03-01T10:00:00.000Z' })
    readAt: Date | null;

    @ApiPropertyOptional({ example: 'Task' })
    resourceType: string | null;

    @ApiPropertyOptional({ example: 'uuid-task' })
    resourceId: string | null;

    @ApiPropertyOptional({ type: Object, description: 'Additional metadata' })
    meta: any;

    @ApiProperty({ example: '2025-03-01T10:00:00.000Z' })
    createdAt: Date;

    constructor(partial: Partial<NotificationEntity>) {
        Object.assign(this, partial);
    }
}
