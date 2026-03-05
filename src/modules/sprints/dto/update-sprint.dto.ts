import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    MinLength,
    MaxLength,
    IsDateString,
    IsInt,
    Min,
} from 'class-validator';

export class UpdateSprintDto {
    @ApiPropertyOptional({ example: 'Sprint 1 - Revised' })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    name?: string;

    @ApiPropertyOptional({ example: 'Updated sprint goal' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    goal?: string;

    @ApiPropertyOptional({ example: '2026-03-10T00:00:00.000Z' })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({ example: '2026-03-24T00:00:00.000Z' })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({ example: 2 })
    @IsOptional()
    @IsInt()
    @Min(0)
    order?: number;
}
