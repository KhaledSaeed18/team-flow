import { registerAs } from '@nestjs/config';
import { optionalEnv } from './env';

export interface AppConfig {
    name: string;
    port: number;
    env: string;
    isProduction: boolean;
    isDevelopment: boolean;
    isTest: boolean;
}

export const appConfig = registerAs('app', (): AppConfig => {
    const env = optionalEnv('NODE_ENV', 'development');
    return {
        name: optionalEnv('APP_NAME', 'team-flow'),
        port: parseInt(optionalEnv('PORT', '3000'), 10),
        env,
        isProduction: env === 'production',
        isDevelopment: env === 'development',
        isTest: env === 'test',
    };
});
