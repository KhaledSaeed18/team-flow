import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Resend } from 'resend';
import { EmailTemplate } from './email.types';
import type { EmailPayloadMap } from './email.types';
import type { ResendConfig } from '../../config';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private readonly from: string;

    constructor(
        @Inject('RESEND_CLIENT') private readonly resend: Resend,
        private readonly configService: ConfigService,
    ) {
        const resendCfg = this.configService.get<ResendConfig>('resend')!;
        this.from = `${resendCfg.fromName} <${resendCfg.fromEmail}>`;
    }

    async send<T extends EmailTemplate>(
        template: T,
        payload: EmailPayloadMap[T],
    ): Promise<void> {
        const to = (payload as Record<string, unknown>).to as string;
        const { subject, html } = this.buildEmail(template, payload);

        this.logger.log(`Sending "${template}" email to "${to}"`);

        const { data, error } = await this.resend.emails.send({
            from: this.from,
            to,
            subject,
            html,
        });

        if (error) {
            this.logger.error(
                `Failed to send "${template}" email to "${to}": ${error.message}`,
            );
            throw new Error(`Email send failed: ${error.message}`);
        }

        this.logger.log(
            `Email "${template}" sent to "${to}" (id: ${data?.id})`,
        );
    }

    private buildEmail<T extends EmailTemplate>(
        template: T,
        payload: EmailPayloadMap[T],
    ): { subject: string; html: string } {
        switch (template) {
            case EmailTemplate.INVITATION:
                return this.buildInvitationEmail(
                    payload as EmailPayloadMap[EmailTemplate.INVITATION],
                );
            case EmailTemplate.WELCOME:
                return this.buildWelcomeEmail(
                    payload as EmailPayloadMap[EmailTemplate.WELCOME],
                );
            case EmailTemplate.PASSWORD_RESET:
                return this.buildPasswordResetEmail(
                    payload as EmailPayloadMap[EmailTemplate.PASSWORD_RESET],
                );
            case EmailTemplate.TASK_ASSIGNED:
                return this.buildTaskAssignedEmail(
                    payload as EmailPayloadMap[EmailTemplate.TASK_ASSIGNED],
                );
            case EmailTemplate.TASK_DUE_SOON:
                return this.buildTaskDueSoonEmail(
                    payload as EmailPayloadMap[EmailTemplate.TASK_DUE_SOON],
                );
            case EmailTemplate.TASK_OVERDUE:
                return this.buildTaskOverdueEmail(
                    payload as EmailPayloadMap[EmailTemplate.TASK_OVERDUE],
                );
            default:
                throw new Error(`Unknown email template: ${String(template)}`);
        }
    }

    private buildInvitationEmail(
        payload: EmailPayloadMap[EmailTemplate.INVITATION],
    ) {
        return {
            subject: `You've been invited to join ${payload.orgName}`,
            html: `
                <h2>You're invited!</h2>
                <p><strong>${payload.inviterName}</strong> has invited you to join <strong>${payload.orgName}</strong> on TeamFlow.</p>
                <p>Use the following token to accept your invitation:</p>
                <p style="font-size:18px; font-weight:bold; background:#f4f4f4; padding:12px; border-radius:6px; display:inline-block;">${payload.token}</p>
                <br/><p>If you didn't expect this invitation, you can safely ignore this email.</p>
            `,
        };
    }

    private buildWelcomeEmail(payload: EmailPayloadMap[EmailTemplate.WELCOME]) {
        return {
            subject: `Welcome to ${payload.orgName}!`,
            html: `
                <h2>Welcome, ${payload.name}!</h2>
                <p>You've successfully joined <strong>${payload.orgName}</strong> on TeamFlow.</p>
                <p>You can now collaborate with your team, manage projects, and track tasks.</p>
            `,
        };
    }

    private buildPasswordResetEmail(
        payload: EmailPayloadMap[EmailTemplate.PASSWORD_RESET],
    ) {
        return {
            subject: 'Reset your password',
            html: `
                <h2>Password Reset Request</h2>
                <p>Hi ${payload.name},</p>
                <p>We received a request to reset your password. Click the link below to set a new password:</p>
                <p><a href="${payload.resetUrl}" style="background:#4F46E5; color:#fff; padding:10px 20px; text-decoration:none; border-radius:6px; display:inline-block;">Reset Password</a></p>
                <p>If you didn't request this, you can safely ignore this email.</p>
            `,
        };
    }

    private buildTaskAssignedEmail(
        payload: EmailPayloadMap[EmailTemplate.TASK_ASSIGNED],
    ) {
        return {
            subject: `Task assigned: ${payload.taskTitle}`,
            html: `
                <h2>New Task Assigned</h2>
                <p>Hi ${payload.name},</p>
                <p>You've been assigned a new task: <strong>${payload.taskTitle}</strong></p>
                <p><a href="${payload.taskUrl}" style="background:#4F46E5; color:#fff; padding:10px 20px; text-decoration:none; border-radius:6px; display:inline-block;">View Task</a></p>
            `,
        };
    }

    private buildTaskDueSoonEmail(
        payload: EmailPayloadMap[EmailTemplate.TASK_DUE_SOON],
    ) {
        return {
            subject: `Task due soon: ${payload.taskTitle}`,
            html: `
                <h2>Task Due Soon</h2>
                <p>Hi ${payload.name},</p>
                <p>Your task <strong>${payload.projectKey}-${payload.taskNumber} ${payload.taskTitle}</strong> is due on <strong>${payload.dueDate}</strong>.</p>
                <p>Please make sure to complete it before the deadline.</p>
            `,
        };
    }

    private buildTaskOverdueEmail(
        payload: EmailPayloadMap[EmailTemplate.TASK_OVERDUE],
    ) {
        return {
            subject: `Task overdue: ${payload.taskTitle}`,
            html: `
                <h2>Task Overdue</h2>
                <p>Hi ${payload.name},</p>
                <p>Your task <strong>${payload.projectKey}-${payload.taskNumber} ${payload.taskTitle}</strong> was due on <strong>${payload.dueDate}</strong> and is now overdue.</p>
                <p>Please complete it as soon as possible.</p>
            `,
        };
    }
}
