import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
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
import { LabelsService } from './labels.service';
import { CreateLabelDto, UpdateLabelDto } from './dto';
import { LabelEntity } from './entities';
import { CurrentUser, Roles, AuditLog } from '../../common/decorators';
import { RolesGuard, OrgMemberGuard } from '../../common/guards';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

// ── ORG-SCOPED LABELS ───────────────────────────────────────────────────────

@ApiTags('Labels')
@ApiBearerAuth('access-token')
@Controller('organizations/:orgId/labels')
export class OrgLabelsController {
    constructor(private readonly labelsService: LabelsService) {}

    @Get()
    @UseGuards(OrgMemberGuard)
    @ApiOperation({ summary: 'List org-wide labels' })
    @ApiParam({ name: 'orgId', description: 'Organization UUID' })
    @ApiOkResponse({ type: [LabelEntity], description: 'Org labels' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    async findOrgLabels(@Param('orgId') orgId: string) {
        return this.labelsService.findOrgLabels(orgId);
    }

    @Post()
    @UseGuards(RolesGuard)
    @Roles('ADMIN' as any)
    @AuditLog({ entity: 'Label' })
    @ApiOperation({ summary: 'Create an org-wide label (Admin+)' })
    @ApiParam({ name: 'orgId', description: 'Organization UUID' })
    @ApiBody({ type: CreateLabelDto })
    @ApiCreatedResponse({ type: LabelEntity, description: 'Label created' })
    @ApiBadRequestResponse({ description: 'Validation error' })
    @ApiConflictResponse({ description: 'Label name already exists' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Insufficient role' })
    async createOrgLabel(
        @Param('orgId') orgId: string,
        @CurrentUser() user: JwtPayload,
        @Body() dto: CreateLabelDto,
    ) {
        return this.labelsService.createOrgLabel(orgId, user.sub, dto);
    }
}

// ── PROJECT-SCOPED LABELS ───────────────────────────────────────────────────

@ApiTags('Labels')
@ApiBearerAuth('access-token')
@Controller('projects/:projectId/labels')
export class ProjectLabelsController {
    constructor(private readonly labelsService: LabelsService) {}

    @Get()
    @UseGuards(OrgMemberGuard)
    @ApiOperation({ summary: 'List project-scoped labels' })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiOkResponse({ type: [LabelEntity], description: 'Project labels' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    @ApiNotFoundResponse({ description: 'Project not found' })
    async findProjectLabels(@Param('projectId') projectId: string) {
        return this.labelsService.findProjectLabels(projectId);
    }

    @Post()
    @UseGuards(RolesGuard)
    @Roles('ADMIN' as any)
    @AuditLog({ entity: 'Label' })
    @ApiOperation({ summary: 'Create a project-scoped label (Admin+)' })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiBody({ type: CreateLabelDto })
    @ApiCreatedResponse({ type: LabelEntity, description: 'Label created' })
    @ApiBadRequestResponse({ description: 'Validation error' })
    @ApiConflictResponse({ description: 'Label name already exists' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Insufficient role' })
    @ApiNotFoundResponse({ description: 'Project not found' })
    async createProjectLabel(
        @Param('projectId') projectId: string,
        @CurrentUser() user: JwtPayload,
        @Body() dto: CreateLabelDto,
    ) {
        return this.labelsService.createProjectLabel(projectId, user.sub, dto);
    }
}

// ── LABEL CRUD (by id) ─────────────────────────────────────────────────────

@ApiTags('Labels')
@ApiBearerAuth('access-token')
@Controller('labels')
export class LabelsController {
    constructor(private readonly labelsService: LabelsService) {}

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles('ADMIN' as any)
    @AuditLog({ entity: 'Label' })
    @ApiOperation({ summary: 'Update a label (Admin+)' })
    @ApiParam({ name: 'id', description: 'Label UUID' })
    @ApiBody({ type: UpdateLabelDto })
    @ApiOkResponse({ type: LabelEntity, description: 'Label updated' })
    @ApiBadRequestResponse({ description: 'Validation error' })
    @ApiConflictResponse({ description: 'Label name already exists' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Insufficient role' })
    @ApiNotFoundResponse({ description: 'Label not found' })
    async update(@Param('id') labelId: string, @Body() dto: UpdateLabelDto) {
        return this.labelsService.update(labelId, dto);
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles('ADMIN' as any)
    @HttpCode(HttpStatus.NO_CONTENT)
    @AuditLog({ entity: 'Label', action: 'DELETE' })
    @ApiOperation({ summary: 'Delete a label (Admin+)' })
    @ApiParam({ name: 'id', description: 'Label UUID' })
    @ApiNoContentResponse({ description: 'Label deleted' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Insufficient role' })
    @ApiNotFoundResponse({ description: 'Label not found' })
    async remove(@Param('id') labelId: string) {
        await this.labelsService.remove(labelId);
    }
}

// ── TASK LABELING ───────────────────────────────────────────────────────────

@ApiTags('Labels')
@ApiBearerAuth('access-token')
@Controller('tasks/:taskId/labels')
export class TaskLabelsController {
    constructor(private readonly labelsService: LabelsService) {}

    @Post(':labelId')
    @UseGuards(OrgMemberGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Tag a task with a label' })
    @ApiParam({ name: 'taskId', description: 'Task UUID' })
    @ApiParam({ name: 'labelId', description: 'Label UUID' })
    @ApiNoContentResponse({ description: 'Label applied to task' })
    @ApiConflictResponse({ description: 'Label already on task' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    @ApiNotFoundResponse({ description: 'Task or label not found' })
    async tagTask(
        @Param('taskId') taskId: string,
        @Param('labelId') labelId: string,
    ) {
        await this.labelsService.tagTask(taskId, labelId);
    }

    @Delete(':labelId')
    @UseGuards(OrgMemberGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Remove a label from a task' })
    @ApiParam({ name: 'taskId', description: 'Task UUID' })
    @ApiParam({ name: 'labelId', description: 'Label UUID' })
    @ApiNoContentResponse({ description: 'Label removed from task' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    @ApiNotFoundResponse({ description: 'Label not on this task' })
    async untagTask(
        @Param('taskId') taskId: string,
        @Param('labelId') labelId: string,
    ) {
        await this.labelsService.untagTask(taskId, labelId);
    }
}
