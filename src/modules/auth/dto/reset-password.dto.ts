import { ApiProperty } from '@nestjs/swagger';
import {
    IsEmail,
    IsNotEmpty,
    IsString,
    Length,
    MaxLength,
    MinLength,
} from 'class-validator';

export class ResetPasswordDto {
    @ApiProperty({
        example: 'john@example.com',
        description: 'Email address of the account',
    })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({
        example: '123456',
        description: '6-digit OTP code sent to email',
    })
    @IsString()
    @IsNotEmpty()
    @Length(6, 6)
    code: string;

    @ApiProperty({
        example: 'NewStr0ngP@ss!',
        description: 'New password (8-72 characters)',
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @MaxLength(72)
    newPassword: string;
}
