import { Module } from '@nestjs/common';
import { SprintsController } from './sprints.controller';
import { SprintsService } from './sprints.service';

@Module({
    controllers: [SprintsController],
    providers: [SprintsService],
    exports: [SprintsService],
})
export class SprintsModule {}
