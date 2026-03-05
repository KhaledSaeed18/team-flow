import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogInterceptor } from '../../common/interceptors';

@Module({
    controllers: [AuditLogsController],
    providers: [
        AuditLogsService,
        {
            provide: APP_INTERCEPTOR,
            useClass: AuditLogInterceptor,
        },
    ],
    exports: [AuditLogsService],
})
export class AuditLogsModule {}
