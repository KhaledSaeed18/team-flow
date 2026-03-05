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
} from '@nestjs/swagger';
import { SprintsService } from './sprints.service';
import { CreateSprintDto, UpdateSprintDto } from './dto';
import { SprintEntity } from './entities';
import { Roles } from '../../common/decorators';
import { RolesGuard, OrgMemberGuard } from '../../common/guards';

@ApiTags('Sprints')
@ApiBearerAuth('access-token')
@Controller('projects/:projectId/sprints')
export class SprintsController {
    constructor(private readonly sprintsService: SprintsService) {}

    @Get()
    @UseGuards(OrgMemberGuard)
    @ApiOperation({ summary: 'List all sprints in a project' })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiOkResponse({
        type: [SprintEntity],
        description: 'List of sprints ordered by display order',
    })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    @ApiNotFoundResponse({ description: 'Project not found' })
    async findAll(@Param('projectId') projectId: string) {
        return this.sprintsService.findAll(projectId);
    }

    @Post()
    @UseGuards(RolesGuard)
    @Roles('ADMIN' as any)
    @ApiOperation({ summary: 'Create a new sprint' })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiBody({ type: CreateSprintDto })
    @ApiCreatedResponse({
        type: SprintEntity,
        description: 'Sprint created',
    })
    @ApiBadRequestResponse({
        description: 'Validation failed or project is archived',
    })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN)' })
    @ApiNotFoundResponse({ description: 'Project not found' })
    async create(
        @Param('projectId') projectId: string,
        @Body() dto: CreateSprintDto,
    ) {
        return this.sprintsService.create(projectId, dto);
    }

    @Get(':id')
    @UseGuards(OrgMemberGuard)
    @ApiOperation({ summary: 'Get sprint by ID' })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiParam({ name: 'id', description: 'Sprint UUID' })
    @ApiOkResponse({
        type: SprintEntity,
        description: 'Sprint details',
    })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member of the organization' })
    @ApiNotFoundResponse({ description: 'Sprint not found' })
    async findOne(
        @Param('projectId') projectId: string,
        @Param('id') id: string,
    ) {
        return this.sprintsService.findOne(projectId, id);
    }

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles('ADMIN' as any)
    @ApiOperation({ summary: 'Update sprint details' })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiParam({ name: 'id', description: 'Sprint UUID' })
    @ApiBody({ type: UpdateSprintDto })
    @ApiOkResponse({
        type: SprintEntity,
        description: 'Sprint updated',
    })
    @ApiBadRequestResponse({ description: 'Validation failed' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN)' })
    @ApiNotFoundResponse({ description: 'Sprint not found' })
    async update(
        @Param('projectId') projectId: string,
        @Param('id') id: string,
        @Body() dto: UpdateSprintDto,
    ) {
        return this.sprintsService.update(projectId, id, dto);
    }

    @Post(':id/start')
    @HttpCode(HttpStatus.OK)
    @UseGuards(RolesGuard)
    @Roles('ADMIN' as any)
    @ApiOperation({
        summary: 'Start a sprint (PLANNED → ACTIVE)',
        description:
            'Only one sprint can be ACTIVE per project at a time. Sets startDate to now if not already set.',
    })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiParam({ name: 'id', description: 'Sprint UUID' })
    @ApiOkResponse({
        type: SprintEntity,
        description: 'Sprint started',
    })
    @ApiBadRequestResponse({
        description:
            'Sprint is not in PLANNED status or another sprint is already active',
    })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN)' })
    @ApiNotFoundResponse({ description: 'Sprint or project not found' })
    async start(
        @Param('projectId') projectId: string,
        @Param('id') id: string,
    ) {
        return this.sprintsService.start(projectId, id);
    }

    @Post(':id/complete')
    @HttpCode(HttpStatus.OK)
    @UseGuards(RolesGuard)
    @Roles('ADMIN' as any)
    @ApiOperation({
        summary: 'Complete a sprint (ACTIVE → COMPLETED)',
        description:
            'Incomplete tasks (status != DONE) are moved back to the backlog. Sets endDate to now if not already set.',
    })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiParam({ name: 'id', description: 'Sprint UUID' })
    @ApiOkResponse({
        type: SprintEntity,
        description: 'Sprint completed',
    })
    @ApiBadRequestResponse({
        description: 'Sprint is not in ACTIVE status',
    })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN)' })
    @ApiNotFoundResponse({ description: 'Sprint not found' })
    async complete(
        @Param('projectId') projectId: string,
        @Param('id') id: string,
    ) {
        return this.sprintsService.complete(projectId, id);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(RolesGuard)
    @Roles('ADMIN' as any)
    @ApiOperation({
        summary: 'Delete a sprint',
        description:
            'Cannot delete an active sprint. Tasks in the sprint are moved back to the backlog.',
    })
    @ApiParam({ name: 'projectId', description: 'Project UUID' })
    @ApiParam({ name: 'id', description: 'Sprint UUID' })
    @ApiNoContentResponse({ description: 'Sprint deleted' })
    @ApiBadRequestResponse({ description: 'Cannot delete an active sprint' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN)' })
    @ApiNotFoundResponse({ description: 'Sprint not found' })
    async remove(
        @Param('projectId') projectId: string,
        @Param('id') id: string,
    ) {
        return this.sprintsService.remove(projectId, id);
    }
}
