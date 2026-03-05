import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
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
    ApiConflictResponse,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import {
    CreateTaskDto,
    UpdateTaskDto,
    AssignTaskDto,
    MoveTaskToSprintDto,
    AddDependencyDto,
    QueryTasksDto,
} from './dto';
import {
    TaskEntity,
    TaskDependencyEntity,
    TaskActivityEntity,
} from './entities';
import { CurrentUser, Roles } from '../../common/decorators';
import { RolesGuard, OrgMemberGuard } from '../../common/guards';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Tasks')
@ApiBearerAuth('access-token')
@Controller('projects/:projectId/tasks')
export class TasksController {
    constructor(private readonly tasksService: TasksService) {}

    // ── CRUD ────────────────────────────────────────────────────────────

    @Post()
    @UseGuards(OrgMemberGuard)
    @ApiOperation({ summary: 'Create a new task' })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiBody({ type: CreateTaskDto })
    @ApiCreatedResponse({ type: TaskEntity, description: 'Task created' })
    @ApiBadRequestResponse({
        description: 'Validation error or invalid references',
    })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    @ApiNotFoundResponse({ description: 'Project not found' })
    async create(
        @Param('projectId') projectId: string,
        @CurrentUser() user: JwtPayload,
        @Body() dto: CreateTaskDto,
    ) {
        return this.tasksService.create(projectId, user.sub, dto);
    }

    @Get()
    @UseGuards(OrgMemberGuard)
    @ApiOperation({ summary: 'List tasks with filters and pagination' })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiOkResponse({ description: 'Paginated task list' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    async findAll(
        @Param('projectId') projectId: string,
        @Query() query: QueryTasksDto,
    ) {
        return this.tasksService.findAll(projectId, query);
    }

    @Get('backlog')
    @UseGuards(OrgMemberGuard)
    @ApiOperation({ summary: 'Get backlog tasks (not in any sprint)' })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiOkResponse({ type: [TaskEntity], description: 'Backlog tasks' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    async findBacklog(@Param('projectId') projectId: string) {
        return this.tasksService.findBacklog(projectId);
    }

    @Get(':taskId')
    @UseGuards(OrgMemberGuard)
    @ApiOperation({ summary: 'Get task details' })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiParam({ name: 'taskId', description: 'Task UUID' })
    @ApiOkResponse({ type: TaskEntity, description: 'Task details' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    @ApiNotFoundResponse({ description: 'Task not found' })
    async findOne(
        @Param('projectId') projectId: string,
        @Param('taskId') taskId: string,
    ) {
        return this.tasksService.findOne(projectId, taskId);
    }

    @Patch(':taskId')
    @UseGuards(OrgMemberGuard)
    @ApiOperation({ summary: 'Update a task' })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiParam({ name: 'taskId', description: 'Task UUID' })
    @ApiBody({ type: UpdateTaskDto })
    @ApiOkResponse({ type: TaskEntity, description: 'Task updated' })
    @ApiBadRequestResponse({ description: 'Validation error' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    @ApiNotFoundResponse({ description: 'Task not found' })
    async update(
        @Param('projectId') projectId: string,
        @Param('taskId') taskId: string,
        @CurrentUser() user: JwtPayload,
        @Body() dto: UpdateTaskDto,
    ) {
        return this.tasksService.update(projectId, taskId, user.sub, dto);
    }

    @Delete(':taskId')
    @UseGuards(OrgMemberGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Soft-delete a task' })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiParam({ name: 'taskId', description: 'Task UUID' })
    @ApiNoContentResponse({ description: 'Task soft-deleted' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    @ApiNotFoundResponse({ description: 'Task not found' })
    async softDelete(
        @Param('projectId') projectId: string,
        @Param('taskId') taskId: string,
        @CurrentUser() user: JwtPayload,
    ) {
        await this.tasksService.softDelete(projectId, taskId, user.sub);
    }

    @Patch(':taskId/restore')
    @UseGuards(RolesGuard)
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Restore a soft-deleted task (Admin+)' })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiParam({ name: 'taskId', description: 'Task UUID' })
    @ApiOkResponse({ type: TaskEntity, description: 'Task restored' })
    @ApiBadRequestResponse({ description: 'Task is not deleted' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Insufficient role' })
    @ApiNotFoundResponse({ description: 'Task not found' })
    async restore(
        @Param('projectId') projectId: string,
        @Param('taskId') taskId: string,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.tasksService.restore(projectId, taskId, user.sub);
    }

    // ── ASSIGN ──────────────────────────────────────────────────────────

    @Patch(':taskId/assign')
    @UseGuards(OrgMemberGuard)
    @ApiOperation({ summary: 'Assign or unassign a task' })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiParam({ name: 'taskId', description: 'Task UUID' })
    @ApiBody({ type: AssignTaskDto })
    @ApiOkResponse({ type: TaskEntity, description: 'Task assignment updated' })
    @ApiBadRequestResponse({ description: 'Assignee is not an org member' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    @ApiNotFoundResponse({ description: 'Task not found' })
    async assign(
        @Param('projectId') projectId: string,
        @Param('taskId') taskId: string,
        @CurrentUser() user: JwtPayload,
        @Body() dto: AssignTaskDto,
    ) {
        return this.tasksService.assign(projectId, taskId, user.sub, dto);
    }

    // ── SPRINT MOVE ─────────────────────────────────────────────────────

    @Patch(':taskId/move')
    @UseGuards(OrgMemberGuard)
    @ApiOperation({ summary: 'Move task to sprint or backlog' })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiParam({ name: 'taskId', description: 'Task UUID' })
    @ApiBody({ type: MoveTaskToSprintDto })
    @ApiOkResponse({ type: TaskEntity, description: 'Task moved' })
    @ApiBadRequestResponse({ description: 'Sprint not in this project' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    @ApiNotFoundResponse({ description: 'Task not found' })
    async moveToSprint(
        @Param('projectId') projectId: string,
        @Param('taskId') taskId: string,
        @CurrentUser() user: JwtPayload,
        @Body() dto: MoveTaskToSprintDto,
    ) {
        return this.tasksService.moveToSprint(projectId, taskId, user.sub, dto);
    }

    // ── WATCHERS ────────────────────────────────────────────────────────

    @Post(':taskId/watch')
    @UseGuards(OrgMemberGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Watch a task' })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiParam({ name: 'taskId', description: 'Task UUID' })
    @ApiNoContentResponse({ description: 'Now watching this task' })
    @ApiConflictResponse({ description: 'Already watching this task' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    @ApiNotFoundResponse({ description: 'Task not found' })
    async watch(
        @Param('projectId') projectId: string,
        @Param('taskId') taskId: string,
        @CurrentUser() user: JwtPayload,
    ) {
        await this.tasksService.watch(projectId, taskId, user.sub);
    }

    @Delete(':taskId/watch')
    @UseGuards(OrgMemberGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Unwatch a task' })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiParam({ name: 'taskId', description: 'Task UUID' })
    @ApiNoContentResponse({ description: 'Unwatched this task' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    @ApiNotFoundResponse({ description: 'Task or watcher not found' })
    async unwatch(
        @Param('projectId') projectId: string,
        @Param('taskId') taskId: string,
        @CurrentUser() user: JwtPayload,
    ) {
        await this.tasksService.unwatch(projectId, taskId, user.sub);
    }

    // ── DEPENDENCIES ────────────────────────────────────────────────────

    @Post(':taskId/dependencies')
    @UseGuards(OrgMemberGuard)
    @ApiOperation({ summary: 'Add a dependency (blocking task)' })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiParam({ name: 'taskId', description: 'Dependent task UUID' })
    @ApiBody({ type: AddDependencyDto })
    @ApiCreatedResponse({
        type: TaskDependencyEntity,
        description: 'Dependency added',
    })
    @ApiBadRequestResponse({
        description: 'Self-dependency or circular reference',
    })
    @ApiConflictResponse({ description: 'Dependency already exists' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    @ApiNotFoundResponse({ description: 'Task not found' })
    async addDependency(
        @Param('projectId') projectId: string,
        @Param('taskId') taskId: string,
        @CurrentUser() user: JwtPayload,
        @Body() dto: AddDependencyDto,
    ) {
        return this.tasksService.addDependency(
            projectId,
            taskId,
            user.sub,
            dto,
        );
    }

    @Delete(':taskId/dependencies/:depId')
    @UseGuards(OrgMemberGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Remove a dependency' })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiParam({ name: 'taskId', description: 'Dependent task UUID' })
    @ApiParam({ name: 'depId', description: 'Dependency record UUID' })
    @ApiNoContentResponse({ description: 'Dependency removed' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    @ApiNotFoundResponse({ description: 'Task or dependency not found' })
    async removeDependency(
        @Param('projectId') projectId: string,
        @Param('taskId') taskId: string,
        @Param('depId') depId: string,
        @CurrentUser() user: JwtPayload,
    ) {
        await this.tasksService.removeDependency(
            projectId,
            taskId,
            depId,
            user.sub,
        );
    }

    // ── ACTIVITIES ──────────────────────────────────────────────────────

    @Get(':taskId/activities')
    @UseGuards(OrgMemberGuard)
    @ApiOperation({ summary: 'Get task activity log' })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiParam({ name: 'taskId', description: 'Task UUID' })
    @ApiOkResponse({ type: [TaskActivityEntity], description: 'Activity log' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    @ApiNotFoundResponse({ description: 'Task not found' })
    async getActivities(
        @Param('projectId') projectId: string,
        @Param('taskId') taskId: string,
    ) {
        return this.tasksService.getActivities(projectId, taskId);
    }
}
