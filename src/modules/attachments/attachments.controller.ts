import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    Req,
    HttpCode,
    HttpStatus,
    UseGuards,
} from '@nestjs/common';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiParam,
    ApiBody,
    ApiCreatedResponse,
    ApiOkResponse,
    ApiUnauthorizedResponse,
    ApiForbiddenResponse,
    ApiNotFoundResponse,
    ApiNoContentResponse,
} from '@nestjs/swagger';
import { AttachmentsService } from './attachments.service';
import { SaveAttachmentDto } from './dto';
import { AttachmentEntity } from './entities';
import { CurrentUser, AuditLog } from '../../common/decorators';
import { OrgMemberGuard } from '../../common/guards';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Attachments')
@ApiBearerAuth('access-token')
@Controller('tasks/:taskId/attachments')
export class AttachmentsController {
    constructor(private readonly attachmentsService: AttachmentsService) {}

    @Get()
    @UseGuards(OrgMemberGuard)
    @ApiOperation({ summary: 'List attachments for a task' })
    @ApiParam({ name: 'taskId', description: 'Task UUID' })
    @ApiOkResponse({ type: [AttachmentEntity], description: 'Attachment list' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    @ApiNotFoundResponse({ description: 'Task not found' })
    async findAll(@Param('taskId') taskId: string) {
        return this.attachmentsService.findAll(taskId);
    }

    @Post()
    @UseGuards(OrgMemberGuard)
    @AuditLog({ entity: 'Attachment' })
    @ApiOperation({
        summary: 'Save attachment metadata after UploadThing upload',
    })
    @ApiParam({ name: 'taskId', description: 'Task UUID' })
    @ApiBody({ type: SaveAttachmentDto })
    @ApiCreatedResponse({
        type: AttachmentEntity,
        description: 'Attachment saved',
    })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    @ApiNotFoundResponse({ description: 'Task not found' })
    async save(
        @Param('taskId') taskId: string,
        @CurrentUser() user: JwtPayload,
        @Body() dto: SaveAttachmentDto,
    ) {
        return this.attachmentsService.save(taskId, user.sub, dto);
    }

    @Delete(':id')
    @UseGuards(OrgMemberGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    @AuditLog({ entity: 'Attachment', action: 'DELETE' })
    @ApiOperation({ summary: 'Remove an attachment (uploader or ADMIN+)' })
    @ApiParam({ name: 'taskId', description: 'Task UUID' })
    @ApiParam({ name: 'id', description: 'Attachment UUID' })
    @ApiNoContentResponse({ description: 'Attachment removed from DB and CDN' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not uploader or admin' })
    @ApiNotFoundResponse({ description: 'Attachment not found' })
    async remove(
        @Param('taskId') taskId: string,
        @Param('id') attachmentId: string,
        @CurrentUser() user: JwtPayload,
        @Req() req: any,
    ) {
        const role = req['membership']?.role ?? 'VIEWER';
        await this.attachmentsService.remove(
            taskId,
            attachmentId,
            user.sub,
            role,
        );
    }
}
