import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
    @ApiProperty({ example: 'OldP@ss123' })
    @IsString()
    @IsNotEmpty()
    currentPassword: string;

    @ApiProperty({ example: 'NewP@ss456' })
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @MaxLength(72)
    newPassword: string;
}
