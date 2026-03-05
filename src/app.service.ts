import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './database/prisma.service';
import { AppConfig } from './config';

export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    timestamp: string;
    appName: string;
    environment: string;
    services: {
        database: {
            status: 'up' | 'down';
            responseTime?: number;
            error?: string;
        };
    };
    memory: {
        heapUsed: number;
        heapTotal: number;
        rss: number;
        external: number;
    };
    cpu: {
        user: number;
        system: number;
    };
}

@Injectable()
export class AppService {
    private readonly logger = new Logger(AppService.name);
    private readonly appConfig: AppConfig;

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) {
        this.appConfig = this.configService.get<AppConfig>('app')!;
    }

    async getHealth(): Promise<HealthStatus> {
        const dbStatus = await this.checkDatabase();
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        const overallStatus: HealthStatus['status'] =
            dbStatus.status === 'up' ? 'healthy' : 'unhealthy';

        return {
            status: overallStatus,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            appName: this.appConfig.name,
            environment: this.appConfig.env,
            services: {
                database: dbStatus,
            },
            memory: {
                heapUsed: memoryUsage.heapUsed,
                heapTotal: memoryUsage.heapTotal,
                rss: memoryUsage.rss,
                external: memoryUsage.external,
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system,
            },
        };
    }

    private async checkDatabase(): Promise<
        HealthStatus['services']['database']
    > {
        const start = Date.now();
        try {
            await this.prisma.$executeRaw`SELECT 1`;
            return {
                status: 'up',
                responseTime: Date.now() - start,
            };
        } catch (error) {
            this.logger.error('Database health check failed', error);
            return {
                status: 'down',
                responseTime: Date.now() - start,
                error: 'Database connection failed',
            };
        }
    }
}
