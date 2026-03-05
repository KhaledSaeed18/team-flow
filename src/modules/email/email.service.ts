import { Injectable, Logger } from '@nestjs/common';
import type { EmailTemplate, EmailPayloadMap } from './email.types';

/**
 * Placeholder EmailService — logs emails to the console.
 * Swap the send() implementation with a real SMTP transport (Resend, SendGrid,
 * Postmark, nodemailer) by changing only the transport config.
 * All callers use this same type-safe API.
 */
@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);

    // eslint-disable-next-line @typescript-eslint/require-await
    async send<T extends EmailTemplate>(
        template: T,
        payload: EmailPayloadMap[T],
    ): Promise<void> {
        const to = (payload as Record<string, unknown>).to as string;

        // Placeholder: log instead of sending
        this.logger.log(
            `[EMAIL PLACEHOLDER] Template: "${template}" → To: "${to}"`,
        );
        this.logger.debug(
            `[EMAIL PAYLOAD] ${JSON.stringify(payload, null, 2)}`,
        );
    }
}
