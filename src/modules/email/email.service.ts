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

    private readonly logoUrl =
        'https://0dmx1q3s0v.ufs.sh/f/FhSkiVUnN75kwe9Bf1c3QUqFZpGr2Xd9WySPfb4NCtVKmcJv';

    private wrapInLayout(body: string): string {
        return `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
                <div style="background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%); padding: 32px 24px; text-align: center;">
                    <img src="${this.logoUrl}" alt="TeamFlow" width="48" height="48" style="border-radius: 10px; margin-bottom: 12px;" />
                    <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">TeamFlow</h1>
                </div>
                <div style="padding: 32px 24px;">
                    ${body}
                </div>
                <div style="padding: 16px 24px; background: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} TeamFlow. All rights reserved.</p>
                </div>
            </div>`;
    }

    private buildEmail<T extends EmailTemplate>(
        template: T,
        payload: EmailPayloadMap[T],
    ): { subject: string; html: string } {
        let result: { subject: string; html: string };

        switch (template) {
            case EmailTemplate.INVITATION:
                result = this.buildInvitationEmail(
                    payload as EmailPayloadMap[EmailTemplate.INVITATION],
                );
                break;
            case EmailTemplate.WELCOME:
                result = this.buildWelcomeEmail(
                    payload as EmailPayloadMap[EmailTemplate.WELCOME],
                );
                break;
            case EmailTemplate.PASSWORD_RESET:
                result = this.buildPasswordResetEmail(
                    payload as EmailPayloadMap[EmailTemplate.PASSWORD_RESET],
                );
                break;
            case EmailTemplate.TASK_ASSIGNED:
                result = this.buildTaskAssignedEmail(
                    payload as EmailPayloadMap[EmailTemplate.TASK_ASSIGNED],
                );
                break;
            case EmailTemplate.TASK_DUE_SOON:
                result = this.buildTaskDueSoonEmail(
                    payload as EmailPayloadMap[EmailTemplate.TASK_DUE_SOON],
                );
                break;
            case EmailTemplate.TASK_OVERDUE:
                result = this.buildTaskOverdueEmail(
                    payload as EmailPayloadMap[EmailTemplate.TASK_OVERDUE],
                );
                break;
            case EmailTemplate.EMAIL_VERIFICATION:
                result = this.buildEmailVerificationEmail(
                    payload as EmailPayloadMap[EmailTemplate.EMAIL_VERIFICATION],
                );
                break;
            case EmailTemplate.PASSWORD_RESET_OTP:
                result = this.buildPasswordResetOtpEmail(
                    payload as EmailPayloadMap[EmailTemplate.PASSWORD_RESET_OTP],
                );
                break;
            default:
                throw new Error(`Unknown email template: ${String(template)}`);
        }

        return {
            subject: result.subject,
            html: this.wrapInLayout(result.html),
        };
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

    private buildEmailVerificationEmail(
        payload: EmailPayloadMap[EmailTemplate.EMAIL_VERIFICATION],
    ) {
        return {
            subject: 'Verify your email address',
            html: `
                <h2>Email Verification</h2>
                <p>Hi ${payload.name},</p>
                <p>Thank you for signing up for TeamFlow. Use the following code to verify your email address:</p>
                <div style="text-align: center; margin: 24px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; background: #f4f4f5; padding: 16px 32px; border-radius: 8px; display: inline-block; font-family: monospace;">${payload.code}</span>
                </div>
                <p style="color: #6b7280; font-size: 14px;">This code expires in ${payload.expiresInMinutes} minutes. If you didn't create an account, you can safely ignore this email.</p>
            `,
        };
    }

    private buildPasswordResetOtpEmail(
        payload: EmailPayloadMap[EmailTemplate.PASSWORD_RESET_OTP],
    ) {
        return {
            subject: 'Reset your password',
            html: `
                <h2>Password Reset</h2>
                <p>Hi ${payload.name},</p>
                <p>We received a request to reset your password. Use the following code to proceed:</p>
                <div style="text-align: center; margin: 24px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; background: #f4f4f5; padding: 16px 32px; border-radius: 8px; display: inline-block; font-family: monospace;">${payload.code}</span>
                </div>
                <p style="color: #6b7280; font-size: 14px;">This code expires in ${payload.expiresInMinutes} minutes. If you didn't request a password reset, you can safely ignore this email.</p>
            `,
        };
    }
}
