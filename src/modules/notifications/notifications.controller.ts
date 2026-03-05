import {
    Controller,
    Get,
    Patch,
    Delete,
    Param,
    Query,
    Sse,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiOkResponse,
    ApiNoContentResponse,
    ApiNotFoundResponse,
    ApiUnauthorizedResponse,
    ApiProduces,
    ApiParam,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto';
import { NotificationEntity } from './entities';
import { CurrentUser } from '../../common/decorators';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

interface MessageEvent {
    data: string | object;
    id?: string;
    type?: string;
    retry?: number;
}

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    @Get()
    @ApiOperation({
        summary: 'List notifications (paginated)',
        description:
            'Returns paginated notifications for the current user. Filterable by read status.',
    })
    @ApiOkResponse({
        description: 'Paginated notifications',
        schema: {
            properties: {
                data: {
                    type: 'array',
                    items: {
                        $ref: '#/components/schemas/NotificationEntity',
                    },
                },
                meta: {
                    type: 'object',
                    properties: {
                        total: { type: 'number' },
                        page: { type: 'number' },
                        limit: { type: 'number' },
                        totalPages: { type: 'number' },
                    },
                },
            },
        },
    })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    findAll(
        @CurrentUser() user: JwtPayload,
        @Query() query: QueryNotificationsDto,
    ) {
        return this.notificationsService.findAll(user.sub, query);
    }

    @Get('unread-count')
    @ApiOperation({ summary: 'Get unread notification count' })
    @ApiOkResponse({
        description: 'Unread count',
        schema: {
            properties: { count: { type: 'number', example: 5 } },
        },
    })
    getUnreadCount(@CurrentUser() user: JwtPayload) {
        return this.notificationsService.getUnreadCount(user.sub);
    }

    @Get('stream')
    @Sse()
    @ApiOperation({
        summary: 'Subscribe to real-time SSE notification stream',
        description:
            'Opens a Server-Sent Events connection for real-time notification delivery. Use EventSource on the client.',
    })
    @ApiProduces('text/event-stream')
    stream(@CurrentUser() user: JwtPayload): Observable<MessageEvent> {
        return this.notificationsService.getStream(user.sub);
    }

    @Patch(':id/read')
    @ApiOperation({ summary: 'Mark a single notification as read' })
    @ApiParam({ name: 'id', description: 'Notification UUID' })
    @ApiOkResponse({
        description: 'Notification marked as read',
        type: NotificationEntity,
    })
    @ApiNotFoundResponse({ description: 'Notification not found' })
    markAsRead(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.notificationsService.markAsRead(user.sub, id);
    }

    @Patch('read-all')
    @ApiOperation({ summary: 'Mark all notifications as read' })
    @ApiOkResponse({
        description: 'Count of updated notifications',
        schema: {
            properties: { updated: { type: 'number', example: 12 } },
        },
    })
    markAllAsRead(@CurrentUser() user: JwtPayload) {
        return this.notificationsService.markAllAsRead(user.sub);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a notification' })
    @ApiParam({ name: 'id', description: 'Notification UUID' })
    @ApiNoContentResponse({ description: 'Notification deleted' })
    @ApiNotFoundResponse({ description: 'Notification not found' })
    remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.notificationsService.remove(user.sub, id);
    }
}
