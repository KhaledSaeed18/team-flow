import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';

export class ProjectEntity {
    @ApiProperty({ example: 'uuid-here' })
    id: string;

    @ApiProperty({ example: 'TeamFlow Backend' })
    name: string;

    @ApiPropertyOptional({ example: 'Backend API for TeamFlow' })
    description: string | null;

    @ApiProperty({ enum: ['ACTIVE', 'ARCHIVED'], example: 'ACTIVE' })
    status: string;

    @ApiProperty({ example: 'TFB' })
    key: string;

    @ApiProperty({ example: 'uuid-org' })
    organizationId: string;

    @ApiPropertyOptional({ example: 'uuid-user' })
    createdById: string | null;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    createdAt: Date;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    updatedAt: Date;

    @Exclude()
    deletedAt: Date | null;

    constructor(partial: Partial<ProjectEntity>) {
        Object.assign(this, partial);
    }
}
