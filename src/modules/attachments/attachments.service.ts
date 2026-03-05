import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { UTApi } from 'uploadthing/server';
import { PrismaService } from '../../database/prisma.service';
import { SaveAttachmentDto } from './dto';
import { AttachmentEntity } from './entities';

const uploaderSelect = { id: true, name: true, email: true } as const;

@Injectable()
export class AttachmentsService {
    private readonly utapi = new UTApi();

    constructor(private readonly prisma: PrismaService) {}

    async findAll(taskId: string) {
        await this.ensureTaskExists(taskId);

        const attachments = await this.prisma.attachment.findMany({
            where: { taskId },
            include: { uploadedBy: { select: uploaderSelect } },
            orderBy: { createdAt: 'desc' },
        });

        return attachments.map((a) => new AttachmentEntity(a));
    }

    async save(taskId: string, userId: string, dto: SaveAttachmentDto) {
        await this.ensureTaskExists(taskId);

        const attachment = await this.prisma.attachment.create({
            data: {
                filename: dto.filename,
                mimeType: dto.mimeType,
                size: dto.size,
                url: dto.url,
                fileKey: dto.fileKey ?? null,
                source: (dto.source as any) ?? 'UPLOAD',
                taskId,
                uploadedById: userId,
            },
            include: { uploadedBy: { select: uploaderSelect } },
        });

        return new AttachmentEntity(attachment);
    }

    async remove(
        taskId: string,
        attachmentId: string,
        userId: string,
        userRole: string,
    ) {
        await this.ensureTaskExists(taskId);

        const attachment = await this.prisma.attachment.findFirst({
            where: { id: attachmentId, taskId },
        });

        if (!attachment) {
            throw new NotFoundException('Attachment not found');
        }

        // Uploader or ADMIN+ can delete
        const isAdmin = ['OWNER', 'ADMIN'].includes(userRole);
        if (attachment.uploadedById !== userId && !isAdmin) {
            throw new ForbiddenException(
                'Only the uploader or an admin can delete this attachment',
            );
        }

        // Delete from UploadThing CDN if it was uploaded via UT
        if (attachment.source === 'UPLOAD' && attachment.fileKey) {
            await this.utapi.deleteFiles(attachment.fileKey);
        }

        await this.prisma.attachment.delete({ where: { id: attachmentId } });
    }

    // ── PRIVATE HELPERS ─────────────────────────────────────────────────

    private async ensureTaskExists(taskId: string) {
        const task = await this.prisma.task.findFirst({
            where: { id: taskId, deletedAt: null },
        });
        if (!task) throw new NotFoundException('Task not found');
        return task;
    }
}
