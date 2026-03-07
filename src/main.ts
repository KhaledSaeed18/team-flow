import { NestFactory, Reflector } from '@nestjs/core';
import {
    ClassSerializerInterceptor,
    Logger,
    ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { createRouteHandler } from 'uploadthing/express';
import { AppModule } from './app.module';
import { AppConfig } from './config';
import { GlobalExceptionFilter } from './common/filters';
import { TransformInterceptor } from './common/interceptors';
import { uploadRouter } from './modules/attachments/upload.router';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);
    const appConfig = configService.get<AppConfig>('app')!;
    const logger = new Logger('Bootstrap');

    // Global prefix
    app.setGlobalPrefix('api');

    // Security
    app.use(helmet());

    app.enableCors({
        origin:
            appConfig.corsOrigins.length > 0 ? appConfig.corsOrigins : false,
        credentials: true,
    });

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

    // UploadThing route handler (before Swagger, after global prefix)
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.use(
        '/api/uploadthing',
        createRouteHandler({ router: uploadRouter }),
    );

    // Swagger
    const swaggerConfig = new DocumentBuilder()
        .setTitle('TeamFlow API')
        .setDescription('Multi-tenant project management platform API')
        .setVersion('1.0')
        .addBearerAuth(
            { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            'access-token',
        )
        .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
        swaggerOptions: { persistAuthorization: true },
    });
    logger.log(`Swagger docs available at /api/docs`);

    await app.listen(appConfig.port);
    logger.log(
        `Application running on port ${appConfig.port} [${appConfig.env}]`,
    );
}
void bootstrap();
