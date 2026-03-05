import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddDependencyDto {
    @ApiProperty({
        example: 'uuid-blocking-task',
        description:
            'The task UUID that blocks this task (dependencyTaskId). Creates a "blocks" relationship.',
    })
    @IsUUID()
    dependencyTaskId: string;
}
