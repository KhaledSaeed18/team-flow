import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';

/**
 * Cleans up expired and revoked refresh tokens from the database.
 * Runs every day at 2:00 AM.
 *
 * "Cron: DELETE WHERE expiresAt < now() to keep table clean"
 */
@Injectable()
export class TokenCleanupService {
    private readonly logger = new Logger(TokenCleanupService.name);

    constructor(private readonly prisma: PrismaService) {}

    @Cron(CronExpression.EVERY_DAY_AT_2AM, {
        name: 'token-cleanup',
    })
    async handleTokenCleanup(): Promise<void> {
        const jobStart = Date.now();
        this.logger.log('Starting expired token cleanup...');

        try {
            // Delete tokens that are either expired or revoked
            const { count: expiredCount } =
                await this.prisma.refreshToken.deleteMany({
                    where: {
                        expiresAt: { lt: new Date() },
                    },
                });

            const { count: revokedCount } =
                await this.prisma.refreshToken.deleteMany({
                    where: {
                        revokedAt: { not: null },
                    },
                });

            const duration = Date.now() - jobStart;
            this.logger.log(
                `Token cleanup completed in ${duration}ms — ` +
                    `expired: ${expiredCount}, revoked: ${revokedCount}`,
            );
        } catch (error) {
            const duration = Date.now() - jobStart;
            this.logger.error(
                `Token cleanup failed after ${duration}ms`,
                error instanceof Error ? error.stack : String(error),
            );
        }
    }
}
