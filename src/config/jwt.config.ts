import { registerAs } from '@nestjs/config';
import { requireEnv, optionalEnv } from './env';

export interface JwtConfig {
    secret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
    refreshSecret: string;
}

export const jwtConfig = registerAs(
    'jwt',
    (): JwtConfig => ({
        secret: requireEnv('JWT_SECRET'),
        accessExpiresIn: optionalEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
        refreshSecret: requireEnv('JWT_REFRESH_SECRET'),
        refreshExpiresIn: optionalEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
    }),
);
