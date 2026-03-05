import { registerAs } from '@nestjs/config';
import { optionalEnv } from './env';

export interface ThrottlerConfig {
    ttl: number;
    limit: number;
}

export const throttlerConfig = registerAs(
    'throttler',
    (): ThrottlerConfig => ({
        ttl: parseInt(optionalEnv('THROTTLE_TTL', '60'), 10),
        limit: parseInt(optionalEnv('THROTTLE_LIMIT', '10'), 10),
    }),
);
