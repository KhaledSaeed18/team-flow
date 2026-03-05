import {
    Controller,
    Get,
    Post,
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
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto';
import { InvitationEntity } from './entities';
import { CurrentUser, Public, Roles, AuditLog } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Invitations')
@Controller()
export class InvitationsController {
    constructor(private readonly invitationsService: InvitationsService) {}

    // ── Org-scoped endpoints (ADMIN required) ──────────────────────────

    @Post('organizations/:orgId/invitations')
    @UseGuards(RolesGuard)
    @Roles('ADMIN' as any)
    @AuditLog({ entity: 'Invitation', action: 'INVITE' })
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Send an invitation to join the organization' })
    @ApiParam({ name: 'orgId', description: 'Organization UUID' })
    @ApiBody({ type: CreateInvitationDto })
    @ApiCreatedResponse({
        type: InvitationEntity,
        description: 'Invitation sent',
    })
    @ApiBadRequestResponse({ description: 'Validation failed' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN)' })
    @ApiNotFoundResponse({ description: 'Organization not found' })
    @ApiConflictResponse({
        description:
            'Pending invitation already exists or user is already a member',
    })
    async send(
        @Param('orgId') orgId: string,
        @CurrentUser() user: JwtPayload,
        @Body() dto: CreateInvitationDto,
    ) {
        return this.invitationsService.send(orgId, user.sub, dto);
    }

    @Get('organizations/:orgId/invitations')
    @UseGuards(RolesGuard)
    @Roles('ADMIN' as any)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'List all invitations for an organization' })
    @ApiParam({ name: 'orgId', description: 'Organization UUID' })
    @ApiOkResponse({
        type: [InvitationEntity],
        description: 'List of invitations',
    })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN)' })
    async findAll(@Param('orgId') orgId: string) {
        return this.invitationsService.findAllForOrg(orgId);
    }

    @Delete('organizations/:orgId/invitations/:id')
    @UseGuards(RolesGuard)
    @Roles('ADMIN' as any)
    @HttpCode(HttpStatus.OK)
    @AuditLog({ entity: 'Invitation', action: 'DELETE' })
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Revoke a pending invitation' })
    @ApiParam({ name: 'orgId', description: 'Organization UUID' })
    @ApiParam({ name: 'id', description: 'Invitation UUID' })
    @ApiOkResponse({
        type: InvitationEntity,
        description: 'Invitation revoked',
    })
    @ApiBadRequestResponse({ description: 'Invitation is not pending' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Insufficient role (requires ADMIN)' })
    @ApiNotFoundResponse({ description: 'Invitation not found' })
    async revoke(@Param('orgId') orgId: string, @Param('id') id: string) {
        return this.invitationsService.revoke(orgId, id);
    }

    // ── Token-based endpoints (public / JWT) ───────────────────────────

    @Get('invitations/:token')
    @Public()
    @ApiOperation({
        summary: 'Get invitation info by token (public)',
        description:
            'Used by the invitee to view invitation details before accepting/declining.',
    })
    @ApiParam({ name: 'token', description: 'Invitation token (UUID)' })
    @ApiOkResponse({
        type: InvitationEntity,
        description: 'Invitation details',
    })
    @ApiNotFoundResponse({ description: 'Invitation not found' })
    async getByToken(@Param('token') token: string) {
        return this.invitationsService.getByToken(token);
    }

    @Post('invitations/:token/accept')
    @AuditLog({ entity: 'Invitation', action: 'JOIN', idParam: 'token' })
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Accept an invitation',
        description:
            'Authenticated user accepts the invitation and becomes an org member.',
    })
    @ApiParam({ name: 'token', description: 'Invitation token (UUID)' })
    @ApiOkResponse({
        type: InvitationEntity,
        description: 'Invitation accepted — membership created',
    })
    @ApiBadRequestResponse({ description: 'Invitation expired or not pending' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiNotFoundResponse({ description: 'Invitation not found' })
    @ApiConflictResponse({
        description: 'Already a member of this organization',
    })
    async accept(
        @Param('token') token: string,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.invitationsService.accept(token, user.sub);
    }

    @Post('invitations/:token/decline')
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Decline an invitation' })
    @ApiParam({ name: 'token', description: 'Invitation token (UUID)' })
    @ApiOkResponse({
        type: InvitationEntity,
        description: 'Invitation declined',
    })
    @ApiBadRequestResponse({ description: 'Invitation is not pending' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiNotFoundResponse({ description: 'Invitation not found' })
    async decline(@Param('token') token: string) {
        return this.invitationsService.decline(token);
    }
}
