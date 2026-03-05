import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';

export class MoveTaskToSprintDto {
    @ApiProperty({
        example: 'uuid-sprint',
        description:
            'Sprint UUID to move the task to (null to move to backlog)',
        nullable: true,
    })
    @IsOptional()
    @IsUUID()
    sprintId: string | null;
}
