import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsNotEmpty,
    IsString,
    IsOptional,
    IsInt,
    IsEnum,
    IsUrl,
    MaxLength,
} from 'class-validator';

export class SaveAttachmentDto {
    @ApiProperty({ example: 'design-spec.pdf' })
    @IsNotEmpty()
    @IsString()
    filename: string;

    @ApiProperty({ example: 'application/pdf' })
    @IsNotEmpty()
    @IsString()
    mimeType: string;

    @ApiProperty({ example: 1048576, description: 'File size in bytes' })
    @IsNotEmpty()
    @IsInt()
    size: number;

    @ApiProperty({ example: 'https://utfs.io/f/abc123.pdf' })
    @IsNotEmpty()
    @IsUrl()
    url: string;

    @ApiPropertyOptional({
        example: 'abc123',
        description: 'UploadThing file key for CDN deletion',
    })
    @IsOptional()
    @IsString()
    @MaxLength(512)
    fileKey?: string;

    @ApiPropertyOptional({
        enum: ['UPLOAD', 'GOOGLE_DRIVE', 'DROPBOX', 'URL'],
        default: 'UPLOAD',
    })
    @IsOptional()
    @IsEnum(['UPLOAD', 'GOOGLE_DRIVE', 'DROPBOX', 'URL'])
    source?: string;
}
