import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

// ── HTML Escaping (prevents XSS in email templates) ─────────────────────
const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

export function escapeHtml(str: string): string {
    return str.replace(/[&<>"']/g, (ch) => htmlEscapeMap[ch]);
}

// ── OTP ─────────────────────────────────────────────────────────────────
const OTP_LENGTH = 6;
const OTP_HASH_ROUNDS = 10;
const OTP_EXPIRY_MINUTES = 15;
const OTP_MAX_ATTEMPTS = 5;

export function generateSecureOtp(): string {
    // Generate a cryptographically secure random 6-digit OTP
    // Using rejection sampling to avoid modulo bias
    const max = 999999;
    const min = 100000;
    const range = max - min + 1;

    let otp: number;
    do {
        const buf = crypto.randomBytes(4);
        otp = buf.readUInt32BE(0);
    } while (otp >= Math.floor(0x100000000 / range) * range);

    return String(min + (otp % range));
}

export async function hashOtp(otp: string): Promise<string> {
    return bcrypt.hash(otp, OTP_HASH_ROUNDS);
}

export async function verifyOtp(otp: string, hash: string): Promise<boolean> {
    return bcrypt.compare(otp, hash);
}

export function getOtpExpiryDate(): Date {
    return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}

export { OTP_LENGTH, OTP_EXPIRY_MINUTES, OTP_MAX_ATTEMPTS };
