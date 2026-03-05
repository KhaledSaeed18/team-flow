import { GlobalRole } from '../../generated/prisma/enums';

export interface JwtPayload {
    sub: string;
    email: string;
    globalRole: GlobalRole;
    iat?: number;
    exp?: number;
}
