import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { MembershipRole } from '../../../generated/prisma/enums';

export class CreateInvitationDto {
    @ApiProperty({
        example: 'jane@example.com',
        description: 'Email of the invitee',
    })
    @IsEmail()
    email: string;

    @ApiPropertyOptional({
        enum: ['ADMIN', 'MEMBER', 'VIEWER'],
        default: 'MEMBER',
        description: 'Role to assign upon acceptance',
    })
    @IsOptional()
    @IsEnum(MembershipRole, {
        message: 'Role must be ADMIN, MEMBER, or VIEWER',
    })
    role?: MembershipRole;
}
