import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SprintEntity {
    @ApiProperty({ example: 'uuid-here' })
    id: string;

    @ApiProperty({ example: 'Sprint 1' })
    name: string;

    @ApiPropertyOptional({ example: 'Complete auth module' })
    goal: string | null;

    @ApiPropertyOptional({ example: '2026-03-10T00:00:00.000Z' })
    startDate: Date | null;

    @ApiPropertyOptional({ example: '2026-03-24T00:00:00.000Z' })
    endDate: Date | null;

    @ApiProperty({
        enum: ['PLANNED', 'ACTIVE', 'COMPLETED'],
        example: 'PLANNED',
    })
    status: string;

    @ApiProperty({ example: 'uuid-project' })
    projectId: string;

    @ApiProperty({ example: 0 })
    order: number;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    createdAt: Date;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    updatedAt: Date;

    constructor(partial: Partial<SprintEntity>) {
        Object.assign(this, partial);
    }
}
