import {
    Controller,
    Post,
    Get,
    Patch,
    Body,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiBody,
    ApiCreatedResponse,
    ApiOkResponse,
    ApiBadRequestResponse,
    ApiUnauthorizedResponse,
    ApiForbiddenResponse,
    ApiConflictResponse,
    ApiNoContentResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
    RegisterDto,
    LoginDto,
    RefreshTokenDto,
    UpdateProfileDto,
    ChangePasswordDto,
} from './dto';
import { AuthResponseEntity, UserEntity } from './entities';
import { Public, CurrentUser } from '../../common/decorators';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('register')
    @Public()
    @Throttle({ default: { ttl: 60000, limit: 5 } })
    @ApiOperation({ summary: 'Create a new user account' })
    @ApiBody({ type: RegisterDto })
    @ApiCreatedResponse({
        type: AuthResponseEntity,
        description: 'User registered successfully',
    })
    @ApiBadRequestResponse({ description: 'Validation failed' })
    @ApiConflictResponse({ description: 'Email already registered' })
    async register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Post('login')
    @Public()
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { ttl: 60000, limit: 5 } })
    @ApiOperation({ summary: 'Login with email and password' })
    @ApiBody({ type: LoginDto })
    @ApiOkResponse({
        type: AuthResponseEntity,
        description: 'Login successful',
    })
    @ApiBadRequestResponse({ description: 'Validation failed' })
    @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
    @ApiForbiddenResponse({ description: 'Account is deactivated' })
    async login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Post('refresh')
    @Public()
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { ttl: 60000, limit: 10 } })
    @ApiOperation({ summary: 'Rotate refresh token and get new JWT' })
    @ApiBody({ type: RefreshTokenDto })
    @ApiOkResponse({
        type: AuthResponseEntity,
        description: 'Tokens rotated successfully',
    })
    @ApiUnauthorizedResponse({
        description: 'Invalid, revoked, or expired refresh token',
    })
    async refresh(@Body() dto: RefreshTokenDto) {
        return this.authService.refresh(dto);
    }

    @Post('logout')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Revoke refresh token (logout)' })
    @ApiBody({ type: RefreshTokenDto })
    @ApiNoContentResponse({ description: 'Logged out successfully' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    async logout(@Body() dto: RefreshTokenDto) {
        await this.authService.logout(dto);
    }

    @Get('me')
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiOkResponse({
        type: UserEntity,
        description: 'Current user profile',
    })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    async getMe(@CurrentUser() user: JwtPayload) {
        return this.authService.getMe(user.sub);
    }

    @Patch('me')
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Update current user profile' })
    @ApiBody({ type: UpdateProfileDto })
    @ApiOkResponse({
        type: UserEntity,
        description: 'Profile updated',
    })
    @ApiBadRequestResponse({ description: 'Validation failed' })
    @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT' })
    async updateProfile(
        @CurrentUser() user: JwtPayload,
        @Body() dto: UpdateProfileDto,
    ) {
        return this.authService.updateProfile(user.sub, dto);
    }

    @Patch('me/password')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Change password' })
    @ApiBody({ type: ChangePasswordDto })
    @ApiNoContentResponse({ description: 'Password changed successfully' })
    @ApiBadRequestResponse({ description: 'Validation failed' })
    @ApiUnauthorizedResponse({
        description: 'Invalid JWT or current password incorrect',
    })
    async changePassword(
        @CurrentUser() user: JwtPayload,
        @Body() dto: ChangePasswordDto,
    ) {
        await this.authService.changePassword(user.sub, dto);
    }
}
