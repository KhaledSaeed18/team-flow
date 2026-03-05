import { createUploadthing } from 'uploadthing/express';
import type { FileRouter } from 'uploadthing/express';
import * as jwt from '@nestjs/jwt';

const f = createUploadthing();

export const uploadRouter: FileRouter = {
    taskAttachment: f({
        image: { maxFileSize: '8MB', maxFileCount: 5 },
        pdf: { maxFileSize: '16MB' },
        blob: { maxFileSize: '32MB' },
    })
        .middleware(async ({ req }) => {
            const authHeader = req.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                throw new Error('Unauthorized');
            }

            const token = authHeader.split(' ')[1];
            const jwtService = new jwt.JwtService({
                secret: process.env.JWT_SECRET,
            });

            const payload = await jwtService.verifyAsync(token);
            if (!payload?.sub) throw new Error('Unauthorized');

            return { userId: payload.sub as string };
        })
        .onUploadComplete(({ metadata, file }) => {
            return {
                uploadedBy: metadata.userId,
                url: file.ufsUrl,
                key: file.key,
                name: file.name,
                size: file.size,
                type: file.type,
            };
        }),
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;
