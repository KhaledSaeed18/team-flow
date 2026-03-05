import { NestFactory, Reflector } from '@nestjs/core';
import {
    ClassSerializerInterceptor,
    Logger,
    ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config';
import { GlobalExceptionFilter } from './common/filters';
import { TransformInterceptor } from './common/interceptors';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);
    const appConfig = configService.get<AppConfig>('app')!;
    const logger = new Logger('Bootstrap');

    // Global prefix
    app.setGlobalPrefix('api');

    // Security
    app.use(helmet());
    app.enableCors();

    // Validation
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    // Global interceptors
    app.useGlobalInterceptors(
        new TransformInterceptor(),
        new ClassSerializerInterceptor(app.get(Reflector)),
    );

    // Global exception filter
    app.useGlobalFilters(new GlobalExceptionFilter());

    // Swagger — non-production only
    if (!appConfig.isProduction) {
        const config = new DocumentBuilder()
            .setTitle('TeamFlow API')
            .setDescription('Multi-tenant project management platform API')
            .setVersion('1.0')
            .addBearerAuth(
                { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
                'access-token',
            )
            .build();

        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup('api/docs', app, document, {
            swaggerOptions: { persistAuthorization: true },
        });
        logger.log('Swagger docs available at /api/docs');
    }

    await app.listen(appConfig.port);
    logger.log(
        `Application running on port ${appConfig.port} [${appConfig.env}]`,
    );
}
void bootstrap();
