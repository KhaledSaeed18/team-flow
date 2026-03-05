import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
    appConfig,
    databaseConfig,
    jwtConfig,
    throttlerConfig,
    JwtConfig,
    ThrottlerConfig,
} from './config';
import { PrismaModule } from './database/prisma.module';
import { JwtAuthGuard } from './common/guards';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { SprintsModule } from './modules/sprints/sprints.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { CommentsModule } from './modules/comments/comments.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { LabelsModule } from './modules/labels/labels.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { EmailModule } from './modules/email/email.module';
import { CronModule } from './modules/cron/cron.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
            load: [appConfig, databaseConfig, jwtConfig, throttlerConfig],
        }),
        JwtModule.registerAsync({
            global: true,
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const jwt = config.get<JwtConfig>('jwt')!;
                return {
                    secret: jwt.secret,
                    signOptions: {
                        expiresIn:
                            jwt.accessExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
                    },
                };
            },
        }),
        ThrottlerModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const throttler = config.get<ThrottlerConfig>('throttler')!;
                return [
                    {
                        ttl: throttler.ttl * 1000,
                        limit: throttler.limit,
                    },
                ];
            },
        }),
        ScheduleModule.forRoot(),
        PrismaModule,
        EmailModule,
        AuthModule,
        UsersModule,
        OrganizationsModule,
        MembershipsModule,
        InvitationsModule,
        ProjectsModule,
        SprintsModule,
        TasksModule,
        CommentsModule,
        AttachmentsModule,
        LabelsModule,
        AuditLogsModule,
        NotificationsModule,
        CronModule,
    ],
    controllers: [AppController],
    providers: [
        AppService,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
    ],
})
export class AppModule {}
