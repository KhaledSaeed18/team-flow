import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
    @ApiProperty({ example: 'john@example.com' })
    @IsEmail()
    @IsNotEmpty()
    @Transform(({ value }) =>
        typeof value === 'string' ? value.toLowerCase().trim() : value,
    )
    email: string;

    @ApiProperty({ example: 'StrongP@ss1' })
    @IsString()
    @IsNotEmpty()
    password: string;
}
