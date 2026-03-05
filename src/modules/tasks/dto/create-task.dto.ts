import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateTaskDto {
    @ApiProperty({ example: 'Implement login page', description: 'Task title' })
    @IsString()
    @MinLength(1)
    @MaxLength(255)
    title: string;

    @ApiPropertyOptional({
        example: 'Build the login page with email and password fields',
        description: 'Task description',
    })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    description?: string;

    @ApiPropertyOptional({
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'MEDIUM',
        description: 'Task priority',
    })
    @IsOptional()
    @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], {
        message: 'Priority must be LOW, MEDIUM, HIGH, or CRITICAL',
    })
    priority?: string;

    @ApiPropertyOptional({
        example: 5,
        description: 'Story points estimation (Fibonacci recommended)',
    })
    @IsOptional()
    @IsInt()
    @Min(0)
    storyPoints?: number;

    @ApiPropertyOptional({
        example: '2026-03-15T00:00:00.000Z',
        description: 'Due date (ISO 8601)',
    })
    @IsOptional()
    @IsDateString()
    dueDate?: string;

    @ApiPropertyOptional({
        example: 'uuid-sprint',
        description: 'Sprint UUID — omit to add to backlog',
    })
    @IsOptional()
    @IsUUID()
    sprintId?: string;

    @ApiPropertyOptional({
        example: 'uuid-parent-task',
        description: 'Parent task UUID for subtask hierarchy',
    })
    @IsOptional()
    @IsUUID()
    parentTaskId?: string;

    @ApiPropertyOptional({
        example: 'uuid-assignee',
        description: 'User UUID to assign',
    })
    @IsOptional()
    @IsUUID()
    assignedToId?: string;
}
