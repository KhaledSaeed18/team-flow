import {
    Controller,
    Get,
    Patch,
    Delete,
    Param,
    Body,
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
    ApiOkResponse,
    ApiBadRequestResponse,
    ApiUnauthorizedResponse,
    ApiForbiddenResponse,
    ApiNotFoundResponse,
    ApiNoContentResponse,
} from '@nestjs/swagger';
import { MembershipsService } from './memberships.service';
import { UpdateMemberRoleDto } from './dto';
import { MembershipEntity } from './entities';
import { CurrentUser, Roles, AuditLog } from '../../common/decorators';
import { RolesGuard, OrgMemberGuard } from '../../common/guards';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Memberships')
@ApiBearerAuth('access-token')
@Controller('organizations/:orgId/members')
export class MembershipsController {
    constructor(private readonly membershipsService: MembershipsService) {}

    @Get()
    @UseGuards(OrgMemberGuard)
    @ApiOperation({ summary: 'List organization members' })
    @ApiParam({ name: 'orgId', description: 'Organization UUID' })
    @ApiOkResponse({
        type: [MembershipEntity],
        description: 'List of members',
    })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Not a member' })
    async findAll(@Param('orgId') orgId: string) {
        return this.membershipsService.findAll(orgId);
    }

    @Patch(':userId')
    @UseGuards(RolesGuard)
    @Roles('ADMIN' as any)
    @AuditLog({ entity: 'Membership', idParam: 'userId' })
    @ApiOperation({ summary: "Change a member's role" })
    @ApiParam({ name: 'orgId', description: 'Organization UUID' })
    @ApiParam({ name: 'userId', description: 'Target user UUID' })
    @ApiBody({ type: UpdateMemberRoleDto })
    @ApiOkResponse({
        type: MembershipEntity,
        description: 'Role updated',
    })
    @ApiBadRequestResponse({ description: 'Validation failed' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN)' })
    @ApiNotFoundResponse({ description: 'Membership not found' })
    async updateRole(
        @Param('orgId') orgId: string,
        @Param('userId') userId: string,
        @CurrentUser() actor: JwtPayload,
        @Body() dto: UpdateMemberRoleDto,
    ) {
        return this.membershipsService.updateRole(
            orgId,
            userId,
            actor.sub,
            dto,
        );
    }

    @Delete(':userId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(RolesGuard)
    @Roles('ADMIN' as any)
    @AuditLog({ entity: 'Membership', idParam: 'userId', action: 'DELETE' })
    @ApiOperation({ summary: 'Remove a member from the organization' })
    @ApiParam({ name: 'orgId', description: 'Organization UUID' })
    @ApiParam({ name: 'userId', description: 'Target user UUID' })
    @ApiNoContentResponse({ description: 'Member removed' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN)' })
    @ApiNotFoundResponse({ description: 'Membership not found' })
    async removeMember(
        @Param('orgId') orgId: string,
        @Param('userId') userId: string,
        @CurrentUser() actor: JwtPayload,
    ) {
        await this.membershipsService.removeMember(orgId, userId, actor.sub);
    }

    @Delete('me')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(OrgMemberGuard)
    @AuditLog({ entity: 'Membership', action: 'LEAVE' })
    @ApiOperation({ summary: 'Leave the organization' })
    @ApiParam({ name: 'orgId', description: 'Organization UUID' })
    @ApiNoContentResponse({ description: 'Left the organization' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({
        description: 'Owner cannot leave — transfer first',
    })
    async leave(
        @Param('orgId') orgId: string,
        @CurrentUser() user: JwtPayload,
    ) {
        await this.membershipsService.leaveOrganization(orgId, user.sub);
    }
}
