import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateCommentDto {
    @ApiProperty({ example: 'This looks good, but needs more tests.' })
    @IsNotEmpty()
    @IsString()
    body: string;

    @ApiPropertyOptional({
        example: 'uuid-parent-comment',
        description: 'Parent comment ID for threaded reply',
    })
    @IsOptional()
    @IsUUID()
    parentId?: string;
}
