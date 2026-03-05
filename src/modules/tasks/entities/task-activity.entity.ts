import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TaskActivityEntity {
    @ApiProperty({ example: 'uuid-here' })
    id: string;

    @ApiProperty({ example: 'uuid-task' })
    taskId: string;

    @ApiPropertyOptional({ example: 'uuid-actor' })
    actorId: string | null;

    @ApiProperty({ example: 'changed status from TODO to IN_PROGRESS' })
    action: string;

    @ApiPropertyOptional({ example: 'status' })
    field: string | null;

    @ApiPropertyOptional({ example: 'TODO' })
    oldValue: string | null;

    @ApiPropertyOptional({ example: 'IN_PROGRESS' })
    newValue: string | null;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    createdAt: Date;

    // Optional relation
    actor?: { id: string; name: string; email: string } | null;

    constructor(partial: Partial<TaskActivityEntity>) {
        Object.assign(this, partial);
    }
}
