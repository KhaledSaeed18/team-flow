// Test script used to verify that the Resend email integration is working correctly.
// pnpm test:resend

import 'dotenv/config';
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const FROM_NAME = process.env.RESEND_FROM_NAME;
const TO_EMAIL = 'khaled18saeed@gmail.com';

async function main() {
    if (!RESEND_API_KEY) {
        console.error('RESEND_API_KEY is not set in .env');
        process.exit(1);
    }

    const resend = new Resend(RESEND_API_KEY);

    console.log(`Sending test email to ${TO_EMAIL}...`);

    const { data, error } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: TO_EMAIL,
        subject: 'TeamFlow – Resend Test Email',
        html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
                <div style="background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%); padding: 32px 24px; text-align: center;">
                    <img src="https://0dmx1q3s0v.ufs.sh/f/FhSkiVUnN75kwe9Bf1c3QUqFZpGr2Xd9WySPfb4NCtVKmcJv" alt="TeamFlow" width="48" height="48" style="border-radius: 10px; margin-bottom: 12px;" />
                    <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">Team Flow</h1>
                </div>
                <div style="padding: 32px 24px;">
                    <h2 style="color: #1f2937; margin-top: 0;">Resend Integration Test</h2>
                    <p style="color: #374151; line-height: 1.6;">If you're reading this, the Resend email integration is working correctly.</p>
                    <p style="color: #374151; line-height: 1.6;"><strong>Sent at:</strong> ${new Date().toISOString()}</p>
                </div>
                <div style="padding: 16px 24px; background: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} TeamFlow. All rights reserved.</p>
                </div>
            </div>
        `,
    });

    if (error) {
        console.error('Failed to send email:', error);
        process.exit(1);
    }

    console.log('Email sent successfully!');
    console.log('Email ID:', data?.id);
}

void main();
