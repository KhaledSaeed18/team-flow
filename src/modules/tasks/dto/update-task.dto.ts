import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    MinLength,
    MaxLength,
    IsEnum,
    IsInt,
    Min,
    IsDateString,
    IsUUID,
} from 'class-validator';

export class UpdateTaskDto {
    @ApiPropertyOptional({ example: 'Updated task title' })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(255)
    title?: string;

    @ApiPropertyOptional({ example: 'Updated description' })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    description?: string;

    @ApiPropertyOptional({
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    })
    @IsOptional()
    @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], {
        message: 'Priority must be LOW, MEDIUM, HIGH, or CRITICAL',
    })
    priority?: string;

    @ApiPropertyOptional({
        enum: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'],
    })
    @IsOptional()
    @IsEnum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'], {
        message:
            'Status must be TODO, IN_PROGRESS, IN_REVIEW, DONE, or CANCELLED',
    })
    status?: string;

    @ApiPropertyOptional({ example: 5 })
    @IsOptional()
    @IsInt()
    @Min(0)
    storyPoints?: number;

    @ApiPropertyOptional({ example: '2026-03-15T00:00:00.000Z' })
    @IsOptional()
    @IsDateString()
    dueDate?: string;

    @ApiPropertyOptional({
        example: 'uuid-parent-task',
        description: 'Update parent task for subtask hierarchy (null to unset)',
    })
    @IsOptional()
    @IsUUID()
    parentTaskId?: string;
}
