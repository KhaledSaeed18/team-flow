import { DATABASE_URL } from './env';

export interface DatabaseConfig {
    url: string;
}

export const databaseConfig: DatabaseConfig = {
    url: DATABASE_URL,
};
