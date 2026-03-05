import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';

export class AssignTaskDto {
    @ApiProperty({
        example: 'uuid-user',
        description: 'User UUID to assign (null to unassign)',
        nullable: true,
    })
    @IsOptional()
    @IsUUID()
    assignedToId: string | null;
}
