import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';

export class OrganizationEntity {
    @ApiProperty({ example: 'uuid-here' })
    id: string;

    @ApiProperty({ example: 'Acme Corporation' })
    name: string;

    @ApiProperty({ example: 'acme-corp' })
    slug: string;

    @ApiPropertyOptional({ example: 'Building amazing products' })
    description: string | null;

    @ApiPropertyOptional({ example: 'https://acme.com/logo.png' })
    logoUrl: string | null;

    @ApiPropertyOptional({ example: 'https://acme.com' })
    website: string | null;

    @ApiProperty({ example: 'uuid-of-owner' })
    ownerId: string;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    createdAt: Date;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    updatedAt: Date;

    @Exclude()
    deletedAt: Date | null;

    @Exclude()
    settings: unknown;

    constructor(partial: Partial<OrganizationEntity>) {
        Object.assign(this, partial);
    }
}
