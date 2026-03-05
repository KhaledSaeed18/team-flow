import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { AuditAction } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import {
    AUDIT_LOG_KEY,
    AuditLogOptions,
} from '../decorators/audit-log.decorator';

/** Maps HTTP methods to default AuditAction */
const METHOD_ACTION_MAP: Record<string, AuditAction> = {
    POST: AuditAction.CREATE,
    PATCH: AuditAction.UPDATE,
    PUT: AuditAction.UPDATE,
    DELETE: AuditAction.DELETE,
};

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
    private readonly logger = new Logger(AuditLogInterceptor.name);

    constructor(
        private readonly reflector: Reflector,
        private readonly prisma: PrismaService,
    ) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const options = this.reflector.get<AuditLogOptions | undefined>(
            AUDIT_LOG_KEY,
            context.getHandler(),
        );

        // If the handler isn't decorated with @AuditLog(), skip
        if (!options) {
            return next.handle();
        }

        const request = context.switchToHttp().getRequest<Request>();
        const method = request.method.toUpperCase();
        const user = request['user'] as
            | { sub: string; email: string }
            | undefined;

        const action = options.action
            ? (options.action as AuditAction)
            : METHOD_ACTION_MAP[method];

        // Can't determine action — skip
        if (!action) {
            return next.handle();
        }

        const entityId = this.resolveEntityId(request, options);

        // For UPDATE/DELETE we want the "before" snapshot
        const needsBefore = (
            [
                AuditAction.UPDATE,
                AuditAction.DELETE,
                AuditAction.RESTORE,
                AuditAction.ARCHIVE,
                AuditAction.ASSIGN,
                AuditAction.UNASSIGN,
            ] as AuditAction[]
        ).includes(action);

        const beforePromise =
            needsBefore && entityId
                ? this.fetchBefore(options.entity, entityId)
                : Promise.resolve(undefined);

        const ipAddress = this.extractIp(request);
        const userAgent = request.headers['user-agent'] ?? null;

        // Resolve org/project IDs from request params or guard-resolved values
        const organizationId = (request.params.orgId ??
            request['projectOrgId'] ??
            request['taskOrgId'] ??
            null) as string | null;
        const projectId = (request.params.projectId ??
            request['taskProjectId'] ??
            null) as string | null;

        return new Observable((subscriber) => {
            beforePromise
                .then((before) => {
                    next.handle()
                        .pipe(
                            tap({
                                next: (responseData) => {
                                    // Extract "after" from response data
                                    const after =
                                        this.extractAfter(responseData);
                                    const resolvedEntityId =
                                        entityId ??
                                        this.extractIdFromResponse(
                                            responseData,
                                        );

                                    if (resolvedEntityId) {
                                        this.writeLog({
                                            actorId: user?.sub ?? null,
                                            organizationId,
                                            projectId,
                                            action,
                                            entity: options.entity,
                                            entityId: resolvedEntityId,
                                            before: before ?? undefined,
                                            after: after ?? undefined,
                                            ipAddress,
                                            userAgent,
                                        });
                                    }
                                },
                            }),
                        )
                        .subscribe(subscriber);
                })
                .catch((err) => {
                    this.logger.error('Failed to fetch before snapshot', err);
                    next.handle().subscribe(subscriber);
                });
        });
    }

    // ── PRIVATE HELPERS ─────────────────────────────────────────────────

    private resolveEntityId(
        request: Request,
        options: AuditLogOptions,
    ): string | null {
        const paramName = options.idParam ?? 'id';
        return (request.params[paramName] as string) ?? null;
    }

    private extractIp(request: Request): string | null {
        const forwarded = request.headers['x-forwarded-for'];
        if (typeof forwarded === 'string') {
            return forwarded.split(',')[0].trim();
        }
        return request.ip ?? null;
    }

    private static readonly SENSITIVE_FIELDS = new Set([
        'password',
        'token',
        'refreshToken',
    ]);

    private stripSensitiveFields(data: any): any {
        if (!data || typeof data !== 'object') return data;
        const cleaned = { ...data };
        for (const key of AuditLogInterceptor.SENSITIVE_FIELDS) {
            if (key in cleaned) cleaned[key] = '[REDACTED]';
        }
        return cleaned;
    }

    private async fetchBefore(entity: string, entityId: string): Promise<any> {
        try {
            const modelName = entity.charAt(0).toLowerCase() + entity.slice(1);
            const delegate = (this.prisma as any)[modelName];
            if (!delegate?.findUnique) return undefined;

            const record = await delegate.findUnique({
                where: { id: entityId },
            });
            return record ? this.stripSensitiveFields(record) : undefined;
        } catch {
            return undefined;
        }
    }

    private extractAfter(responseData: any): any {
        if (!responseData) return undefined;
        // If response is wrapped by TransformInterceptor: { data, meta }
        // At this point the response is still raw (before TransformInterceptor wraps it)
        if (responseData?.id) return this.stripSensitiveFields(responseData);
        if (responseData?.data?.id)
            return this.stripSensitiveFields(responseData.data);
        return undefined;
    }

    private extractIdFromResponse(responseData: any): string | null {
        if (!responseData) return null;
        if (responseData?.id) return responseData.id;
        if (responseData?.data?.id) return responseData.data.id;
        return null;
    }

    private writeLog(input: {
        actorId: string | null;
        organizationId: string | null;
        projectId: string | null;
        action: AuditAction;
        entity: string;
        entityId: string;
        before?: any;
        after?: any;
        ipAddress: string | null;
        userAgent: string | null;
    }): void {
        // Fire-and-forget — never block the response
        this.prisma.auditLog
            .create({
                data: {
                    actorId: input.actorId,
                    organizationId: input.organizationId,
                    projectId: input.projectId,
                    action: input.action,
                    entity: input.entity,
                    entityId: input.entityId,
                    before: input.before ?? undefined,
                    after: input.after ?? undefined,
                    ipAddress: input.ipAddress,
                    userAgent: input.userAgent,
                },
            })
            .catch((error) => {
                this.logger.error('Failed to write audit log', error);
            });
    }
}
