import {
    Injectable,
    ConflictException,
    UnauthorizedException,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { JwtConfig } from '../../config';
import {
    RegisterDto,
    LoginDto,
    RefreshTokenDto,
    UpdateProfileDto,
    ChangePasswordDto,
} from './dto';
import { UserEntity } from './entities';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private readonly jwtConfig: JwtConfig;

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {
        this.jwtConfig = this.configService.get<JwtConfig>('jwt')!;
    }

    async register(dto: RegisterDto) {
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (existing) {
            throw new ConflictException('Email already registered');
        }

        const hashedPassword = await bcrypt.hash(dto.password, 12);

        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                password: hashedPassword,
                name: dto.name,
            },
        });

        const tokens = await this.generateTokens(
            user.id,
            user.email,
            user.globalRole,
        );
        await this.storeRefreshToken(user.id, tokens.refreshToken);

        this.logger.log(`User registered: ${user.email}`);

        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: new UserEntity(user),
        };
    }

    async login(dto: LoginDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }
        if (!user.isActive) {
            throw new ForbiddenException('Account is deactivated');
        }
        if (user.deletedAt) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const passwordValid = await bcrypt.compare(dto.password, user.password);
        if (!passwordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const tokens = await this.generateTokens(
            user.id,
            user.email,
            user.globalRole,
        );
        await this.storeRefreshToken(user.id, tokens.refreshToken);

        // Update lastSeenAt
        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastSeenAt: new Date() },
        });

        this.logger.log(`User logged in: ${user.email}`);

        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: new UserEntity(user),
        };
    }

    async refresh(dto: RefreshTokenDto) {
        const tokenHash = this.hashToken(dto.refreshToken);

        const storedToken = await this.prisma.refreshToken.findUnique({
            where: { token: tokenHash },
            include: { user: true },
        });

        if (!storedToken) {
            throw new UnauthorizedException('Invalid refresh token');
        }
        if (storedToken.revokedAt) {
            throw new UnauthorizedException('Refresh token has been revoked');
        }
        if (storedToken.expiresAt < new Date()) {
            throw new UnauthorizedException('Refresh token has expired');
        }
        if (!storedToken.user.isActive) {
            throw new ForbiddenException('Account is deactivated');
        }

        // Rotate: revoke old token
        await this.prisma.refreshToken.update({
            where: { id: storedToken.id },
            data: { revokedAt: new Date() },
        });

        // Issue new tokens
        const { user } = storedToken;
        const tokens = await this.generateTokens(
            user.id,
            user.email,
            user.globalRole,
        );
        await this.storeRefreshToken(user.id, tokens.refreshToken);

        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: new UserEntity(user),
        };
    }

    async logout(dto: RefreshTokenDto) {
        const tokenHash = this.hashToken(dto.refreshToken);

        const storedToken = await this.prisma.refreshToken.findUnique({
            where: { token: tokenHash },
        });

        if (storedToken && !storedToken.revokedAt) {
            await this.prisma.refreshToken.update({
                where: { id: storedToken.id },
                data: { revokedAt: new Date() },
            });
        }
    }

    async getMe(userId: string) {
        const user = await this.prisma.user.findUniqueOrThrow({
            where: { id: userId },
        });
        return new UserEntity(user);
    }

    async updateProfile(userId: string, dto: UpdateProfileDto) {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: dto,
        });
        return new UserEntity(user);
    }

    async changePassword(userId: string, dto: ChangePasswordDto) {
        const user = await this.prisma.user.findUniqueOrThrow({
            where: { id: userId },
        });

        const passwordValid = await bcrypt.compare(
            dto.currentPassword,
            user.password,
        );
        if (!passwordValid) {
            throw new UnauthorizedException('Current password is incorrect');
        }

        const hashedPassword = await bcrypt.hash(dto.newPassword, 12);

        await this.prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });

        // Revoke all refresh tokens on password change
        await this.prisma.refreshToken.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }

    // ─── Private Helpers ───────────────────────────────────────────────

    private async generateTokens(
        userId: string,
        email: string,
        globalRole: string,
    ) {
        const payload: JwtPayload = {
            sub: userId,
            email,
            globalRole: globalRole as JwtPayload['globalRole'],
        };

        const accessToken = await this.jwtService.signAsync(payload);
        const refreshToken = crypto.randomBytes(64).toString('hex');

        return { accessToken, refreshToken };
    }

    private async storeRefreshToken(userId: string, rawToken: string) {
        const tokenHash = this.hashToken(rawToken);
        const expiresAt = this.calculateRefreshExpiry();

        await this.prisma.refreshToken.create({
            data: {
                userId,
                token: tokenHash,
                expiresAt,
            },
        });
    }

    private hashToken(token: string): string {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    private calculateRefreshExpiry(): Date {
        const expiresIn = this.jwtConfig.refreshExpiresIn;
        const ms = this.parseDuration(expiresIn);
        return new Date(Date.now() + ms);
    }

    private parseDuration(duration: string): number {
        const match = duration.match(/^(\d+)([smhd])$/);
        if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days

        const value = parseInt(match[1], 10);
        const unit = match[2];

        const multipliers: Record<string, number> = {
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000,
        };

        return value * (multipliers[unit] ?? 24 * 60 * 60 * 1000);
    }
}
