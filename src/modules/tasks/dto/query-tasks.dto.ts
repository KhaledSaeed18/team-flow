import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsUUID, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryTasksDto {
    @ApiPropertyOptional({
        enum: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'],
    })
    @IsOptional()
    @IsEnum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'])
    status?: string;

    @ApiPropertyOptional({
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    })
    @IsOptional()
    @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    priority?: string;

    @ApiPropertyOptional({ example: 'uuid-user' })
    @IsOptional()
    @IsUUID()
    assignedToId?: string;

    @ApiPropertyOptional({ example: 'uuid-sprint' })
    @IsOptional()
    @IsUUID()
    sprintId?: string;

    @ApiPropertyOptional({ example: 'uuid-parent-task' })
    @IsOptional()
    @IsUUID()
    parentTaskId?: string;

    @ApiPropertyOptional({ example: 1, default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ example: 20, default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number;
}
