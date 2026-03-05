import { registerAs } from '@nestjs/config';
import { requireEnv, optionalEnv } from './env';

export interface ResendConfig {
    apiKey: string;
    fromEmail: string;
    fromName: string;
}

export const resendConfig = registerAs(
    'resend',
    (): ResendConfig => ({
        apiKey: requireEnv('RESEND_API_KEY'),
        fromEmail: optionalEnv(
            'RESEND_FROM_EMAIL',
            'noreply@mail.khaledsaeed.tech',
        ),
        fromName: optionalEnv('RESEND_FROM_NAME', 'TeamFlow'),
    }),
);
