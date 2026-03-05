import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuditLogEntity {
    @ApiProperty({ example: 'uuid-audit-log' })
    id: string;

    @ApiPropertyOptional({ example: 'uuid-user' })
    actorId: string | null;

    @ApiPropertyOptional({ example: 'uuid-org' })
    organizationId: string | null;

    @ApiPropertyOptional({ example: 'uuid-project' })
    projectId: string | null;

    @ApiProperty({
        enum: [
            'CREATE',
            'UPDATE',
            'DELETE',
            'RESTORE',
            'ARCHIVE',
            'INVITE',
            'JOIN',
            'LEAVE',
            'ASSIGN',
            'UNASSIGN',
        ],
        example: 'UPDATE',
    })
    action: string;

    @ApiProperty({
        example: 'Task',
        description: 'Model name of affected entity',
    })
    entity: string;

    @ApiProperty({
        example: 'uuid-entity',
        description: 'UUID of affected entity',
    })
    entityId: string;

    @ApiPropertyOptional({
        description: 'JSON snapshot before change',
        type: Object,
    })
    before: any;

    @ApiPropertyOptional({
        description: 'JSON snapshot after change',
        type: Object,
    })
    after: any;

    @ApiPropertyOptional({ example: '192.168.1.1' })
    ipAddress: string | null;

    @ApiPropertyOptional({ example: 'Mozilla/5.0...' })
    userAgent: string | null;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    createdAt: Date;

    actor?: {
        id: string;
        name: string;
        email: string;
    } | null;

    constructor(partial: Partial<AuditLogEntity>) {
        Object.assign(this, partial);
    }
}
