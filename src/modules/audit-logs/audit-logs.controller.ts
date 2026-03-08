import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiParam,
    ApiOkResponse,
    ApiUnauthorizedResponse,
    ApiForbiddenResponse,
    ApiExtraModels,
    getSchemaPath,
} from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { QueryAuditLogsDto } from './dto';
import { AuditLogEntity } from './entities';
import { Roles } from '../../common/decorators';
import { OrgMemberGuard, RolesGuard } from '../../common/guards';

@ApiTags('Audit Logs')
@ApiBearerAuth('access-token')
@Controller('organizations/:orgId/audit-logs')
@UseGuards(OrgMemberGuard, RolesGuard)
@ApiExtraModels(AuditLogEntity)
export class AuditLogsController {
    constructor(private readonly auditLogsService: AuditLogsService) {}

    @Get()
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'List audit logs for an organization',
        description:
            'Returns a paginated, filterable list of immutable audit log entries. ADMIN+ only.',
    })
    @ApiParam({ name: 'orgId', description: 'Organization UUID' })
    @ApiOkResponse({
        description: 'Paginated audit log entries',
        schema: {
            properties: {
                items: {
                    type: 'array',
                    items: { $ref: getSchemaPath(AuditLogEntity) },
                },
                total: { type: 'number', example: 150 },
                page: { type: 'number', example: 1 },
                limit: { type: 'number', example: 25 },
                totalPages: { type: 'number', example: 6 },
            },
        },
    })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    @ApiForbiddenResponse({ description: 'Requires ADMIN role or higher' })
    async findAll(
        @Param('orgId') orgId: string,
        @Query() query: QueryAuditLogsDto,
    ) {
        return this.auditLogsService.findAll(orgId, query);
    }
}
