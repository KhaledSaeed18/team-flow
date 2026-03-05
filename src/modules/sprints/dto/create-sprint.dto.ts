import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    MinLength,
    MaxLength,
    IsDateString,
    IsInt,
    Min,
} from 'class-validator';

export class CreateSprintDto {
    @ApiProperty({ example: 'Sprint 1', description: 'Sprint name' })
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    name: string;

    @ApiPropertyOptional({
        example: 'Complete user authentication module',
        description: 'Sprint goal statement',
    })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    goal?: string;

    @ApiPropertyOptional({
        example: '2026-03-10T00:00:00.000Z',
        description: 'Sprint start date (ISO 8601)',
    })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({
        example: '2026-03-24T00:00:00.000Z',
        description: 'Sprint end date (ISO 8601)',
    })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({
        example: 1,
        description: 'Display order within the project',
    })
    @IsOptional()
    @IsInt()
    @Min(0)
    order?: number;
}
