// Central environment variable registry, required vars throw at startup if missing, optional vars are typed with a defined fallback.

function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

function optionalEnv(key: string, fallback: string): string {
    return process.env[key] ?? fallback;
}

// APP Configuration
export const NODE_ENV = optionalEnv('NODE_ENV', 'development');
export const PORT = optionalEnv('PORT', '3000');
export const APP_NAME = optionalEnv('APP_NAME', 'team-flow');

// Database Configuration
export const DATABASE_URL = requireEnv('DATABASE_URL');

// Helper flags
export const isProduction = NODE_ENV === 'production';
export const isDevelopment = NODE_ENV === 'development';
export const isTest = NODE_ENV === 'test';
