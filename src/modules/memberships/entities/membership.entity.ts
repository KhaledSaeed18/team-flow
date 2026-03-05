import { ApiProperty } from '@nestjs/swagger';

export class MembershipEntity {
    @ApiProperty({ example: 'uuid-here' })
    id: string;

    @ApiProperty({ example: 'uuid-user' })
    userId: string;

    @ApiProperty({ example: 'uuid-org' })
    organizationId: string;

    @ApiProperty({
        enum: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
        example: 'MEMBER',
    })
    role: string;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    joinedAt: Date;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    updatedAt: Date;

    @ApiProperty({ nullable: true, example: null })
    invitedById: string | null;

    // Included when relations are loaded
    user?: {
        id: string;
        email: string;
        name: string;
        avatarUrl: string | null;
    };

    constructor(partial: Partial<MembershipEntity>) {
        Object.assign(this, partial);
    }
}
