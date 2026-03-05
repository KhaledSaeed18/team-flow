import { ApiProperty } from '@nestjs/swagger';

export class TaskDependencyEntity {
    @ApiProperty({ example: 'uuid-here' })
    id: string;

    @ApiProperty({
        example: 'uuid-blocked-task',
        description: 'The task that is blocked',
    })
    dependentTaskId: string;

    @ApiProperty({
        example: 'uuid-blocking-task',
        description: 'The task that blocks',
    })
    dependencyTaskId: string;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    createdAt: Date;

    // Optional relation data
    dependencyTask?: {
        id: string;
        number: number;
        title: string;
        status: string;
    };

    constructor(partial: Partial<TaskDependencyEntity>) {
        Object.assign(this, partial);
    }
}
