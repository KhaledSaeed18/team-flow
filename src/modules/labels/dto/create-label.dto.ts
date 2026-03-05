import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateLabelDto {
    @ApiProperty({ example: 'Bug' })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiProperty({ example: '#FF5733', description: 'Hex color code' })
    @IsNotEmpty()
    @IsString()
    @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, {
        message: 'color must be a valid hex color (e.g. #FF5733 or #F00)',
    })
    color: string;
}
