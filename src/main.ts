import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { appConfig } from './config';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    await app.listen(appConfig.port);
}
void bootstrap();
