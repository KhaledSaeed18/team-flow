import { ApiProperty } from '@nestjs/swagger';

export class MessageResponseEntity {
    @ApiProperty({ example: 'Operation completed successfully' })
    message: string;

    constructor(message: string) {
        this.message = message;
    }
}
