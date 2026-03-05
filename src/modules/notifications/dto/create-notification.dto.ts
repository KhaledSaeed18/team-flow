import type { NotificationType } from '../../../generated/prisma/enums';
import type { InputJsonValue } from '../../../generated/prisma/internal/prismaNamespace';

export interface CreateNotificationDto {
    type: NotificationType;
    title: string;
    body?: string;
    resourceType?: string;
    resourceId?: string;
    meta?: InputJsonValue;
}
