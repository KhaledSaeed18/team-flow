import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LabelEntity {
    @ApiProperty({ example: 'uuid-label' })
    id: string;

    @ApiProperty({ example: 'Bug' })
    name: string;

    @ApiProperty({ example: '#FF5733' })
    color: string;

    @ApiProperty({ example: 'uuid-org' })
    organizationId: string;

    @ApiPropertyOptional({ example: 'uuid-project' })
    projectId: string | null;

    @ApiPropertyOptional({ example: 'uuid-creator' })
    createdById: string | null;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    createdAt: Date;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    updatedAt: Date;

    // Optional relations
    createdBy?: { id: string; name: string; email: string } | null;
    _count?: { tasks: number };

    constructor(partial: Partial<LabelEntity>) {
        Object.assign(this, partial);
    }
}
