import { Module } from '@nestjs/common';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [NotificationsModule],
    controllers: [InvitationsController],
    providers: [InvitationsService],
    exports: [InvitationsService],
})
export class InvitationsModule {}
