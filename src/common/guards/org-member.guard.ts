import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class OrgMemberGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request['user'] as JwtPayload | undefined;
        if (!user) throw new ForbiddenException('Authentication required');

        // SUPER_ADMIN bypasses membership check
        if (user.globalRole === 'SUPER_ADMIN') return true;

        const orgId =
            (request.params?.orgId as string) || (request.params?.id as string);
        if (!orgId) {
            throw new ForbiddenException('Organization context required');
        }

        const membership = await this.prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: user.sub,
                    organizationId: orgId,
                },
            },
        });

        if (!membership) {
            throw new ForbiddenException(
                'You are not a member of this organization',
            );
        }

        request['membership'] = membership;

        return true;
    }
}
