import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateCommentDto {
    @ApiProperty({ example: 'Updated comment body.' })
    @IsNotEmpty()
    @IsString()
    body: string;
}
