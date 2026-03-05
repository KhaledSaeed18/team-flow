import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [NotificationsModule],
    controllers: [TasksController],
    providers: [TasksService],
    exports: [TasksService],
})
export class TasksModule {}
