import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class TransferOwnershipDto {
    @ApiProperty({
        example: 'uuid-of-new-owner',
        description: 'User ID of the new owner (must be a member)',
    })
    @IsUUID()
    @IsNotEmpty()
    newOwnerId: string;
}
