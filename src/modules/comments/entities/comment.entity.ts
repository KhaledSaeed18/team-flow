import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';

export class CommentEntity {
    @ApiProperty({ example: 'uuid-comment' })
    id: string;

    @ApiProperty({ example: 'This looks good!' })
    body: string;

    @ApiProperty({ enum: ['TEXT', 'SYSTEM'], example: 'TEXT' })
    type: string;

    @ApiProperty({ example: 'uuid-task' })
    taskId: string;

    @ApiPropertyOptional({ example: 'uuid-author' })
    authorId: string | null;

    @ApiProperty({ example: false })
    isEdited: boolean;

    @ApiPropertyOptional({ example: 'uuid-parent-comment' })
    parentId: string | null;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    createdAt: Date;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    updatedAt: Date;

    @Exclude()
    deletedAt: Date | null;

    // Optional relations
    author?: {
        id: string;
        name: string;
        email: string;
        avatarUrl: string | null;
    } | null;
    replies?: CommentEntity[];

    constructor(partial: Partial<CommentEntity>) {
        Object.assign(this, partial);
    }
}
