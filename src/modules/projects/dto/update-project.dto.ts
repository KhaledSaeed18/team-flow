import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateProjectDto {
    @ApiPropertyOptional({ example: 'TeamFlow Backend v2' })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    name?: string;

    @ApiPropertyOptional({
        example: 'Updated backend API description',
    })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;
}
