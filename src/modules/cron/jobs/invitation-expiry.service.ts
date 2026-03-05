import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';

/**
 * Marks PENDING invitations as EXPIRED when their expiresAt date has passed.
 * Runs every hour to catch expiries promptly.
 *
 * "EXPIRED — expiresAt passed — set by cron job"
 */
@Injectable()
export class InvitationExpiryService {
    private readonly logger = new Logger(InvitationExpiryService.name);

    constructor(private readonly prisma: PrismaService) {}

    @Cron(CronExpression.EVERY_HOUR, {
        name: 'invitation-expiry',
    })
    async handleInvitationExpiry(): Promise<void> {
        const jobStart = Date.now();
        this.logger.log('Starting invitation expiry check...');

        try {
            const { count } = await this.prisma.invitation.updateMany({
                where: {
                    status: 'PENDING',
                    expiresAt: { lt: new Date() },
                },
                data: {
                    status: 'EXPIRED',
                },
            });

            const duration = Date.now() - jobStart;
            this.logger.log(
                `Invitation expiry completed in ${duration}ms — ` +
                    `expired: ${count} invitation(s)`,
            );
        } catch (error) {
            const duration = Date.now() - jobStart;
            this.logger.error(
                `Invitation expiry check failed after ${duration}ms`,
                error instanceof Error ? error.stack : String(error),
            );
        }
    }
}
