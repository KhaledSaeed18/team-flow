import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import {
    TokenCleanupService,
    InvitationExpiryService,
    TaskDueSoonService,
    TaskOverdueService,
} from './jobs';

@Module({
    imports: [NotificationsModule],
    providers: [
        TokenCleanupService,
        InvitationExpiryService,
        TaskDueSoonService,
        TaskOverdueService,
    ],
})
export class CronModule {}
