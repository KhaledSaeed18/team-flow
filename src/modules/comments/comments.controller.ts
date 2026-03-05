import {
    Controller,
    Get,
    Post,
    Patch,
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
    ApiBadRequestResponse,
    ApiUnauthorizedResponse,
    ApiForbiddenResponse,
    ApiNotFoundResponse,
    ApiNoContentResponse,
} from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto } from './dto';
import { CommentEntity } from './entities';
import { CurrentUser } from '../../common/decorators';
import { OrgMemberGuard } from '../../common/guards';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Comments')
@ApiBearerAuth('access-token')
@Controller('tasks/:taskId/comments')
export class CommentsController {
    constructor(private readonly commentsService: CommentsService) {}

    @Get()
    @UseGuards(OrgMemberGuard)
    @ApiOperation({ summary: 'List threaded comments for a task' })
    @ApiParam({ name: 'taskId', description: 'Task UUID' })
    @ApiOkResponse({ type: [CommentEntity], description: 'Threaded comments' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    @ApiNotFoundResponse({ description: 'Task not found' })
    async findAll(@Param('taskId') taskId: string) {
        return this.commentsService.findAll(taskId);
    }

    @Post()
    @UseGuards(OrgMemberGuard)
    @ApiOperation({ summary: 'Add a comment to a task' })
    @ApiParam({ name: 'taskId', description: 'Task UUID' })
    @ApiBody({ type: CreateCommentDto })
    @ApiCreatedResponse({ type: CommentEntity, description: 'Comment created' })
    @ApiBadRequestResponse({
        description: 'Validation error or parent not found',
    })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    @ApiNotFoundResponse({ description: 'Task not found' })
    async create(
        @Param('taskId') taskId: string,
        @CurrentUser() user: JwtPayload,
        @Body() dto: CreateCommentDto,
    ) {
        return this.commentsService.create(taskId, user.sub, dto);
    }

    @Patch(':id')
    @UseGuards(OrgMemberGuard)
    @ApiOperation({ summary: 'Edit a comment (author only)' })
    @ApiParam({ name: 'taskId', description: 'Task UUID' })
    @ApiParam({ name: 'id', description: 'Comment UUID' })
    @ApiBody({ type: UpdateCommentDto })
    @ApiOkResponse({ type: CommentEntity, description: 'Comment updated' })
    @ApiBadRequestResponse({ description: 'Validation error' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Only the author can edit' })
    @ApiNotFoundResponse({ description: 'Comment not found' })
    async update(
        @Param('taskId') taskId: string,
        @Param('id') commentId: string,
        @CurrentUser() user: JwtPayload,
        @Body() dto: UpdateCommentDto,
    ) {
        return this.commentsService.update(taskId, commentId, user.sub, dto);
    }

    @Delete(':id')
    @UseGuards(OrgMemberGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Soft-delete a comment (author or ADMIN+)' })
    @ApiParam({ name: 'taskId', description: 'Task UUID' })
    @ApiParam({ name: 'id', description: 'Comment UUID' })
    @ApiNoContentResponse({ description: 'Comment soft-deleted' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not author or admin' })
    @ApiNotFoundResponse({ description: 'Comment not found' })
    async softDelete(
        @Param('taskId') taskId: string,
        @Param('id') commentId: string,
        @CurrentUser() user: JwtPayload,
        @Req() req: any,
    ) {
        const role = req['membership']?.role ?? 'VIEWER';
        await this.commentsService.softDelete(
            taskId,
            commentId,
            user.sub,
            role,
        );
    }
}
