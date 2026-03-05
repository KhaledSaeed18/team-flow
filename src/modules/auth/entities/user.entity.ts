import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { GlobalRole } from '../../../generated/prisma/enums';

export class UserEntity {
    @ApiProperty({ example: 'uuid-here' })
    id: string;

    @ApiProperty({ example: 'john@example.com' })
    email: string;

    @Exclude()
    password: string;

    @ApiProperty({ example: 'John Doe' })
    name: string;

    @ApiProperty({ example: 'https://example.com/avatar.png', nullable: true })
    avatarUrl: string | null;

    @ApiProperty({ enum: ['SUPER_ADMIN', 'USER'], example: 'USER' })
    globalRole: GlobalRole;

    @ApiProperty({ example: true })
    isActive: boolean;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z', nullable: true })
    lastSeenAt: Date | null;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    createdAt: Date;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    updatedAt: Date;

    @Exclude()
    deletedAt: Date | null;

    constructor(partial: Partial<UserEntity>) {
        Object.assign(this, partial);
    }
}
