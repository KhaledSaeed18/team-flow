import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailService } from './email.service';
import type { ResendConfig } from '../../config';

@Global()
@Module({
    providers: [
        {
            provide: 'RESEND_CLIENT',
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const resend = config.get<ResendConfig>('resend')!;
                return new Resend(resend.apiKey);
            },
        },
        EmailService,
    ],
    exports: [EmailService],
})
export class EmailModule {}
