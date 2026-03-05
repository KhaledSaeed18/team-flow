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
import { OrganizationsService } from './organizations.service';
import {
    CreateOrganizationDto,
    UpdateOrganizationDto,
    TransferOwnershipDto,
} from './dto';
import { OrganizationEntity } from './entities';
import { CurrentUser, Roles, AuditLog } from '../../common/decorators';
import { RolesGuard, OrgMemberGuard } from '../../common/guards';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Organizations')
@ApiBearerAuth('access-token')
@Controller('organizations')
export class OrganizationsController {
    constructor(private readonly organizationsService: OrganizationsService) {}

    @Post()
    @AuditLog({ entity: 'Organization' })
    @ApiOperation({ summary: 'Create a new organization' })
    @ApiBody({ type: CreateOrganizationDto })
    @ApiCreatedResponse({
        type: OrganizationEntity,
        description: 'Organization created',
    })
    @ApiBadRequestResponse({ description: 'Validation failed' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiConflictResponse({ description: 'Slug already taken' })
    async create(
        @CurrentUser() user: JwtPayload,
        @Body() dto: CreateOrganizationDto,
    ) {
        return this.organizationsService.create(user.sub, dto);
    }

    @Get()
    @ApiOperation({ summary: "List current user's organizations" })
    @ApiOkResponse({
        type: [OrganizationEntity],
        description: 'List of organizations',
    })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    async findAll(@CurrentUser() user: JwtPayload) {
        return this.organizationsService.findAllForUser(user.sub);
    }

    @Get(':id')
    @UseGuards(OrgMemberGuard)
    @ApiOperation({ summary: 'Get organization by ID' })
    @ApiParam({ name: 'id', description: 'Organization UUID' })
    @ApiOkResponse({
        type: OrganizationEntity,
        description: 'Organization details',
    })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member' })
    @ApiNotFoundResponse({ description: 'Organization not found' })
    async findOne(@Param('id') id: string) {
        return this.organizationsService.findOne(id);
    }

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles('ADMIN' as any)
    @AuditLog({ entity: 'Organization' })
    @ApiOperation({ summary: 'Update organization' })
    @ApiParam({ name: 'id', description: 'Organization UUID' })
    @ApiBody({ type: UpdateOrganizationDto })
    @ApiOkResponse({
        type: OrganizationEntity,
        description: 'Organization updated',
    })
    @ApiBadRequestResponse({ description: 'Validation failed' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN)' })
    @ApiNotFoundResponse({ description: 'Organization not found' })
    async update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
        return this.organizationsService.update(id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @UseGuards(RolesGuard)
    @Roles('OWNER' as any)
    @AuditLog({ entity: 'Organization', action: 'DELETE' })
    @ApiOperation({ summary: 'Soft delete organization (owner only)' })
    @ApiParam({ name: 'id', description: 'Organization UUID' })
    @ApiOkResponse({
        type: OrganizationEntity,
        description: 'Organization soft-deleted',
    })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Only owner can delete' })
    @ApiNotFoundResponse({ description: 'Organization not found' })
    async remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
        return this.organizationsService.softDelete(id, user.sub);
    }

    @Patch(':id/transfer')
    @UseGuards(RolesGuard)
    @Roles('OWNER' as any)
    @AuditLog({ entity: 'Organization', action: 'UPDATE' })
    @ApiOperation({ summary: 'Transfer organization ownership' })
    @ApiParam({ name: 'id', description: 'Organization UUID' })
    @ApiBody({ type: TransferOwnershipDto })
    @ApiOkResponse({
        type: OrganizationEntity,
        description: 'Ownership transferred',
    })
    @ApiBadRequestResponse({ description: 'Validation failed' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Only owner can transfer' })
    @ApiNotFoundResponse({ description: 'Organization not found' })
    async transferOwnership(
        @Param('id') id: string,
        @CurrentUser() user: JwtPayload,
        @Body() dto: TransferOwnershipDto,
    ) {
        return this.organizationsService.transferOwnership(id, user.sub, dto);
    }
}
