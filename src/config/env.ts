export function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

export function optionalEnv(key: string, fallback: string): string {
    return process.env[key] ?? fallback;
}
