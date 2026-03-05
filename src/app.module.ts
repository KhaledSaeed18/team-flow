import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
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
        PrismaModule,
        AuthModule,
        UsersModule,
        OrganizationsModule,
        MembershipsModule,
        InvitationsModule,
        ProjectsModule,
        SprintsModule,
    ],
    controllers: [AppController],
    providers: [
        AppService,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
    ],
})
export class AppModule {}
