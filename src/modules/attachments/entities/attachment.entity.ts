import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttachmentEntity {
    @ApiProperty({ example: 'uuid-attachment' })
    id: string;

    @ApiProperty({ example: 'design-spec.pdf' })
    filename: string;

    @ApiProperty({ example: 'application/pdf' })
    mimeType: string;

    @ApiProperty({ example: 1048576 })
    size: number;

    @ApiProperty({ example: 'https://utfs.io/f/abc123.pdf' })
    url: string;

    @ApiPropertyOptional({ example: 'abc123' })
    fileKey: string | null;

    @ApiProperty({
        enum: ['UPLOAD', 'GOOGLE_DRIVE', 'DROPBOX', 'URL'],
        example: 'UPLOAD',
    })
    source: string;

    @ApiProperty({ example: 'uuid-task' })
    taskId: string;

    @ApiPropertyOptional({ example: 'uuid-uploader' })
    uploadedById: string | null;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    createdAt: Date;

    // Optional relation
    uploadedBy?: { id: string; name: string; email: string } | null;

    constructor(partial: Partial<AttachmentEntity>) {
        Object.assign(this, partial);
    }
}
