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
    ApiConflictResponse,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto';
import { ProjectEntity } from './entities';
import { CurrentUser, Roles } from '../../common/decorators';
import { RolesGuard, OrgMemberGuard } from '../../common/guards';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Projects')
@ApiBearerAuth('access-token')
@Controller('organizations/:orgId/projects')
export class ProjectsController {
    constructor(private readonly projectsService: ProjectsService) {}

    @Get()
    @UseGuards(OrgMemberGuard)
    @ApiOperation({ summary: 'List all projects in the organization' })
    @ApiParam({ name: 'orgId', description: 'Organization UUID' })
    @ApiOkResponse({
        type: [ProjectEntity],
        description: 'List of projects',
    })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member' })
    async findAll(@Param('orgId') orgId: string) {
        return this.projectsService.findAll(orgId);
    }

    @Post()
    @UseGuards(RolesGuard)
    @Roles('ADMIN' as any)
    @ApiOperation({ summary: 'Create a new project' })
    @ApiParam({ name: 'orgId', description: 'Organization UUID' })
    @ApiBody({ type: CreateProjectDto })
    @ApiCreatedResponse({
        type: ProjectEntity,
        description: 'Project created',
    })
    @ApiBadRequestResponse({ description: 'Validation failed' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN)' })
    @ApiConflictResponse({
        description: 'Project key already taken in this org',
    })
    async create(
        @Param('orgId') orgId: string,
        @CurrentUser() user: JwtPayload,
        @Body() dto: CreateProjectDto,
    ) {
        return this.projectsService.create(orgId, user.sub, dto);
    }

    @Get(':id')
    @UseGuards(OrgMemberGuard)
    @ApiOperation({ summary: 'Get project by ID' })
    @ApiParam({ name: 'orgId', description: 'Organization UUID' })
    @ApiParam({ name: 'id', description: 'Project UUID' })
    @ApiOkResponse({
        type: ProjectEntity,
        description: 'Project details',
    })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member' })
    @ApiNotFoundResponse({ description: 'Project not found' })
    async findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
        return this.projectsService.findOne(orgId, id);
    }

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles('ADMIN' as any)
    @ApiOperation({ summary: 'Update project' })
    @ApiParam({ name: 'orgId', description: 'Organization UUID' })
    @ApiParam({ name: 'id', description: 'Project UUID' })
    @ApiBody({ type: UpdateProjectDto })
    @ApiOkResponse({
        type: ProjectEntity,
        description: 'Project updated',
    })
    @ApiBadRequestResponse({ description: 'Validation failed' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN)' })
    @ApiNotFoundResponse({ description: 'Project not found' })
    async update(
        @Param('orgId') orgId: string,
        @Param('id') id: string,
        @Body() dto: UpdateProjectDto,
    ) {
        return this.projectsService.update(orgId, id, dto);
    }

    @Post(':id/archive')
    @HttpCode(HttpStatus.OK)
    @UseGuards(RolesGuard)
    @Roles('ADMIN' as any)
    @ApiOperation({ summary: 'Archive project (makes it read-only)' })
    @ApiParam({ name: 'orgId', description: 'Organization UUID' })
    @ApiParam({ name: 'id', description: 'Project UUID' })
    @ApiOkResponse({
        type: ProjectEntity,
        description: 'Project archived',
    })
    @ApiBadRequestResponse({ description: 'Project is already archived' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN)' })
    @ApiNotFoundResponse({ description: 'Project not found' })
    async archive(@Param('orgId') orgId: string, @Param('id') id: string) {
        return this.projectsService.archive(orgId, id);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @UseGuards(RolesGuard)
    @Roles('ADMIN' as any)
    @ApiOperation({ summary: 'Soft delete project' })
    @ApiParam({ name: 'orgId', description: 'Organization UUID' })
    @ApiParam({ name: 'id', description: 'Project UUID' })
    @ApiOkResponse({
        type: ProjectEntity,
        description: 'Project soft-deleted',
    })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN)' })
    @ApiNotFoundResponse({ description: 'Project not found' })
    async remove(@Param('orgId') orgId: string, @Param('id') id: string) {
        return this.projectsService.softDelete(orgId, id);
    }

    @Post(':id/restore')
    @HttpCode(HttpStatus.OK)
    @UseGuards(RolesGuard)
    @Roles('ADMIN' as any)
    @ApiOperation({ summary: 'Restore a soft-deleted project' })
    @ApiParam({ name: 'orgId', description: 'Organization UUID' })
    @ApiParam({ name: 'id', description: 'Project UUID' })
    @ApiOkResponse({
        type: ProjectEntity,
        description: 'Project restored',
    })
    @ApiBadRequestResponse({ description: 'Project is not deleted' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN)' })
    @ApiNotFoundResponse({ description: 'Project not found' })
    async restore(@Param('orgId') orgId: string, @Param('id') id: string) {
        return this.projectsService.restore(orgId, id);
    }
}
