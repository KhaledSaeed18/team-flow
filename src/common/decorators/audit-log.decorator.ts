import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'auditLog';

export interface AuditLogOptions {
    /** The entity name for the audit log (e.g. 'Task', 'Project') */
    entity: string;
    /** The action — defaults to auto-detect from HTTP method */
    action?: string;
    /** Param name holding the entity ID — defaults to 'id' */
    idParam?: string;
}

/**
 * Marks a controller method for audit logging.
 * The interceptor only logs routes decorated with @AuditLog().
 */
export const AuditLog = (options: AuditLogOptions) =>
    SetMetadata(AUDIT_LOG_KEY, options);
