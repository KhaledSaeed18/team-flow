import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    MinLength,
    MaxLength,
    Matches,
} from 'class-validator';

export class CreateProjectDto {
    @ApiProperty({ example: 'TeamFlow Backend', description: 'Project name' })
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    name: string;

    @ApiPropertyOptional({
        example: 'Backend API for the TeamFlow platform',
        description: 'Project description',
    })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @ApiProperty({
        example: 'TFB',
        description:
            'Short code unique per org, used in task IDs (e.g. TFB-42). Uppercase letters and numbers only, 2-10 chars.',
    })
    @IsString()
    @Matches(/^[A-Z0-9]{2,10}$/, {
        message: 'Key must be 2-10 uppercase letters/numbers (e.g. PROJ)',
    })
    key: string;
}
