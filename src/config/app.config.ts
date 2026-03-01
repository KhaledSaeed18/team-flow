import {
    APP_NAME,
    isDevelopment,
    isProduction,
    isTest,
    NODE_ENV,
    PORT,
} from './env';

export interface AppConfig {
    name: string;
    port: number;
    env: string;
    isProduction: boolean;
    isDevelopment: boolean;
    isTest: boolean;
}

export const appConfig: AppConfig = {
    name: APP_NAME,
    port: parseInt(PORT, 10),
    env: NODE_ENV,
    isProduction,
    isDevelopment,
    isTest,
};
