import { registerAs } from '@nestjs/config';
import { requireEnv } from './env';

export interface DatabaseConfig {
    url: string;
}

export const databaseConfig = registerAs(
    'database',
    (): DatabaseConfig => ({
        url: requireEnv('DATABASE_URL'),
    }),
);
