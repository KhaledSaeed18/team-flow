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
            <h2>Resend Integration Test</h2>
            <p>If you're reading this, the Resend email integration is working correctly.</p>
            <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
            <hr/>
            <p style="color:#888; font-size:12px;">This is a test email from TeamFlow.</p>
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
