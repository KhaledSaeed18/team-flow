import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';

export class TaskEntity {
    @ApiProperty({ example: 'uuid-here' })
    id: string;

    @ApiProperty({ example: 42, description: 'Project-scoped task number' })
    number: number;

    @ApiProperty({ example: 'Implement login page' })
    title: string;

    @ApiPropertyOptional({
        example: 'Build the login page with email/password',
    })
    description: string | null;

    @ApiProperty({
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        example: 'MEDIUM',
    })
    priority: string;

    @ApiProperty({
        enum: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'],
        example: 'TODO',
    })
    status: string;

    @ApiPropertyOptional({ example: 5 })
    storyPoints: number | null;

    @ApiPropertyOptional({ example: '2026-03-15T00:00:00.000Z' })
    dueDate: Date | null;

    @ApiPropertyOptional({ example: '2026-03-14T10:30:00.000Z' })
    completedAt: Date | null;

    @ApiProperty({ example: 'uuid-org' })
    organizationId: string;

    @ApiProperty({ example: 'uuid-project' })
    projectId: string;

    @ApiPropertyOptional({ example: 'uuid-sprint' })
    sprintId: string | null;

    @ApiPropertyOptional({ example: 'uuid-creator' })
    createdById: string | null;

    @ApiPropertyOptional({ example: 'uuid-assignee' })
    assignedToId: string | null;

    @ApiPropertyOptional({ example: 'uuid-parent-task' })
    parentTaskId: string | null;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    createdAt: Date;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    updatedAt: Date;

    @Exclude()
    deletedAt: Date | null;

    // Optional relations
    createdBy?: { id: string; name: string; email: string } | null;
    assignedTo?: {
        id: string;
        name: string;
        email: string;
        avatarUrl: string | null;
    } | null;
    subTasks?: Record<string, any>[];
    dependencies?: Record<string, any>[];
    dependents?: Record<string, any>[];
    _count?: {
        subTasks: number;
        comments: number;
        attachments: number;
        watchers: number;
    };

    constructor(partial: Partial<TaskEntity>) {
        Object.assign(this, partial);
    }
}
