import { Module } from '@nestjs/common';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [NotificationsModule],
    controllers: [MembershipsController],
    providers: [MembershipsService],
    exports: [MembershipsService],
})
export class MembershipsModule {}
