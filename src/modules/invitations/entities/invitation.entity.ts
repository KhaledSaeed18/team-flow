import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InvitationEntity {
    @ApiProperty({ example: 'uuid-here' })
    id: string;

    @ApiProperty({ example: 'jane@example.com' })
    email: string;

    @ApiProperty({ example: 'uuid-org' })
    organizationId: string;

    @ApiProperty({
        enum: ['ADMIN', 'MEMBER', 'VIEWER'],
        example: 'MEMBER',
    })
    role: string;

    @ApiProperty({
        enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED'],
        example: 'PENDING',
    })
    status: string;

    @ApiProperty({ example: 'uuid-token' })
    token: string;

    @ApiProperty({ example: '2026-03-12T12:00:00.000Z' })
    expiresAt: Date;

    @ApiProperty({ example: 'uuid-sender' })
    sentById: string;

    @ApiPropertyOptional({ example: '2026-03-06T12:00:00.000Z' })
    acceptedAt: Date | null;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    createdAt: Date;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    updatedAt: Date;

    // Included when relations are loaded
    organization?: {
        id: string;
        name: string;
        slug: string;
    };

    sentBy?: {
        id: string;
        name: string;
        email: string;
    };

    constructor(partial: Partial<InvitationEntity>) {
        Object.assign(this, partial);
    }
}
