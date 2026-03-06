import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ResendOtpDto {
    @ApiProperty({
        example: 'john@example.com',
        description: 'Email address to resend OTP to',
    })
    @IsEmail()
    @IsNotEmpty()
    email: string;
}
