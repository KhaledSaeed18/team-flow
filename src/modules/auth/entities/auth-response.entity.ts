import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from './user.entity';

export class AuthResponseEntity {
    @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
    accessToken: string;

    @ApiProperty({ example: 'a1b2c3d4e5f6...' })
    refreshToken: string;

    @ApiProperty({ type: UserEntity })
    user: UserEntity;

    constructor(partial: Partial<AuthResponseEntity>) {
        Object.assign(this, partial);
    }
}
