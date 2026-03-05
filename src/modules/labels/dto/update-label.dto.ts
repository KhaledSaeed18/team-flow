import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class UpdateLabelDto {
    @ApiPropertyOptional({ example: 'Feature' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ example: '#33FF57', description: 'Hex color code' })
    @IsOptional()
    @IsString()
    @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, {
        message: 'color must be a valid hex color (e.g. #33FF57 or #3F5)',
    })
    color?: string;
}
