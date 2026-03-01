import {
    Injectable,
    OnModuleInit,
    OnModuleDestroy,
    Logger,
} from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { databaseConfig, isDevelopment } from '../config';

interface QueryEvent {
    timestamp: Date;
    query: string;
    params: string;
    duration: number;
    target: string;
}

interface LogEvent {
    timestamp: Date;
    message: string;
    target: string;
}

@Injectable()
export class PrismaService
    extends PrismaClient
    implements OnModuleInit, OnModuleDestroy
{
    private readonly logger = new Logger(PrismaService.name);

    constructor() {
        const pool: Pool = new Pool({ connectionString: databaseConfig.url });
        const adapter = new PrismaPg(pool);

        super({
            adapter,
            log: [
                { level: 'query', emit: 'event' },
                { level: 'error', emit: 'event' },
                { level: 'warn', emit: 'event' },
            ],
        });

        // Log Prisma queries in development
        if (isDevelopment) {
            this.$on('query' as never, (e: QueryEvent) => {
                this.logger.debug(`Query: ${e.query}`);
                this.logger.debug(`Duration: ${e.duration}ms`);
            });
        }

        // Log Prisma errors
        this.$on('error' as never, (e: LogEvent) => {
            this.logger.error(`Prisma Error: ${e.message}`);
        });

        // Log Prisma warnings
        this.$on('warn' as never, (e: LogEvent) => {
            this.logger.warn(`Prisma Warning: ${e.message}`);
        });

        this.logger.log('PrismaService initialized');
    }

    async onModuleInit() {
        try {
            this.logger.log('Connecting to database...');
            await this.$connect();
            this.logger.log('Successfully connected to database');

            // Test the connection
            await this.testConnection();
        } catch (error) {
            this.logger.error('Failed to connect to database', error);
            throw error;
        }
    }

    async onModuleDestroy() {
        try {
            this.logger.log('Disconnecting from database...');
            await this.$disconnect();
            this.logger.log('Successfully disconnected from database');
        } catch (error) {
            this.logger.error('Error disconnecting from database', error);
        }
    }

    async testConnection(): Promise<void> {
        try {
            await this.$executeRaw`SELECT 1`;
            this.logger.log('Database connection test successful');
        } catch (error) {
            this.logger.error('Database connection test failed', error);
            throw error;
        }
    }
}
