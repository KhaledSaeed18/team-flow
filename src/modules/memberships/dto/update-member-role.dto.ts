import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { MembershipRole } from '../../../generated/prisma/enums';

export class UpdateMemberRoleDto {
    @ApiProperty({
        enum: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
        example: 'ADMIN',
    })
    @IsEnum(MembershipRole)
    @IsNotEmpty()
    role: MembershipRole;
}
