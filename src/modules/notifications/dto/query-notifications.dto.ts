import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class QueryNotificationsDto {
    @ApiPropertyOptional({
        description: 'Filter by read status',
        example: false,
    })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    isRead?: boolean;

    @ApiPropertyOptional({ default: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;
}
