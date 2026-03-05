import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiOkResponse,
    ApiServiceUnavailableResponse,
    ApiProperty,
} from '@nestjs/swagger';
import { AppService, HealthStatus } from './app.service';
import { Public } from './common/decorators';

class DatabaseHealthDto {
    @ApiProperty({ enum: ['up', 'down'], example: 'up' })
    status: string;

    @ApiProperty({
        example: 3,
        description: 'Response time in ms',
        required: false,
    })
    responseTime?: number;

    @ApiProperty({
        required: false,
        description: 'Error message if database is down',
    })
    error?: string;
}

class ServicesDto {
    @ApiProperty({ type: DatabaseHealthDto })
    database: DatabaseHealthDto;
}

class MemoryDto {
    @ApiProperty({
        example: 54321152,
        description: 'Heap memory used in bytes',
    })
    heapUsed: number;

    @ApiProperty({
        example: 75497472,
        description: 'Total heap memory in bytes',
    })
    heapTotal: number;

    @ApiProperty({
        example: 95420416,
        description: 'Resident set size in bytes',
    })
    rss: number;

    @ApiProperty({ example: 1234567, description: 'External memory in bytes' })
    external: number;
}

class CpuDto {
    @ApiProperty({
        example: 123456,
        description: 'User CPU time in microseconds',
    })
    user: number;

    @ApiProperty({
        example: 65432,
        description: 'System CPU time in microseconds',
    })
    system: number;
}

class HealthResponseDto {
    @ApiProperty({
        enum: ['healthy', 'degraded', 'unhealthy'],
        example: 'healthy',
    })
    status: string;

    @ApiProperty({
        example: 12345.67,
        description: 'Process uptime in seconds',
    })
    uptime: number;

    @ApiProperty({ example: '2026-03-05T12:00:00.000Z' })
    timestamp: string;

    @ApiProperty({ example: 'team-flow' })
    appName: string;

    @ApiProperty({ example: 'development' })
    environment: string;

    @ApiProperty({ type: ServicesDto })
    services: ServicesDto;

    @ApiProperty({ type: MemoryDto })
    memory: MemoryDto;

    @ApiProperty({ type: CpuDto })
    cpu: CpuDto;
}

@ApiTags('Health')
@Controller()
export class AppController {
    constructor(private readonly appService: AppService) {}

    @Get()
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Health check',
        description:
            'Returns the health status of the application including database connectivity, memory usage, CPU usage, and uptime.',
    })
    @ApiOkResponse({
        description: 'Service is healthy',
        type: HealthResponseDto,
    })
    @ApiServiceUnavailableResponse({
        description: 'Service is unhealthy — one or more dependencies are down',
    })
    async getHealth(): Promise<HealthStatus> {
        return this.appService.getHealth();
    }
}
