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
    ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
    RegisterDto,
    LoginDto,
    RefreshTokenDto,
    UpdateProfileDto,
    ChangePasswordDto,
    VerifyEmailDto,
    ResendOtpDto,
    ForgotPasswordDto,
    ResetPasswordDto,
} from './dto';
import {
    AuthResponseEntity,
    UserEntity,
    MessageResponseEntity,
} from './entities';
import { Public, CurrentUser } from '../../common/decorators';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('register')
    @Public()
    @Throttle({ default: { ttl: 60000, limit: 5 } })
    @ApiOperation({
        summary: 'Create a new user account',
        description:
            'Registers a new user and sends a 6-digit OTP to the provided email for verification. The user must verify their email before logging in.',
    })
    @ApiBody({ type: RegisterDto })
    @ApiCreatedResponse({
        type: MessageResponseEntity,
        description: 'User registered successfully. Verification email sent.',
    })
    @ApiBadRequestResponse({ description: 'Validation failed' })
    @ApiConflictResponse({ description: 'Email already registered' })
    async register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Post('verify-email')
    @Public()
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { ttl: 60000, limit: 5 } })
    @ApiOperation({
        summary: 'Verify email with OTP',
        description:
            'Verifies the user email using the 6-digit OTP sent during registration. Returns auth tokens on success.',
    })
    @ApiBody({ type: VerifyEmailDto })
    @ApiOkResponse({
        type: AuthResponseEntity,
        description: 'Email verified successfully. Tokens returned.',
    })
    @ApiBadRequestResponse({
        description:
            'Invalid/expired code, email already verified, or too many failed attempts',
    })
    async verifyEmail(@Body() dto: VerifyEmailDto) {
        return await this.authService.verifyEmail(dto);
    }

    @Post('resend-verification')
    @Public()
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { ttl: 60000, limit: 3 } })
    @ApiOperation({
        summary: 'Resend email verification OTP',
        description:
            'Resends a new 6-digit OTP to the provided email. Previous OTPs are invalidated. Response is always successful to prevent email enumeration.',
    })
    @ApiBody({ type: ResendOtpDto })
    @ApiOkResponse({
        type: MessageResponseEntity,
        description: 'Verification email resent (if applicable)',
    })
    @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
    async resendVerification(@Body() dto: ResendOtpDto) {
        return await this.authService.resendVerificationOtp(dto);
    }

    @Post('forgot-password')
    @Public()
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { ttl: 60000, limit: 3 } })
    @ApiOperation({
        summary: 'Request password reset OTP',
        description:
            'Sends a 6-digit OTP to the provided email for password reset. Response is always successful to prevent email enumeration.',
    })
    @ApiBody({ type: ForgotPasswordDto })
    @ApiOkResponse({
        type: MessageResponseEntity,
        description: 'Password reset email sent (if applicable)',
    })
    @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        return await this.authService.forgotPassword(dto);
    }

    @Post('reset-password')
    @Public()
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { ttl: 60000, limit: 5 } })
    @ApiOperation({
        summary: 'Reset password using OTP',
        description:
            'Resets the user password using the 6-digit OTP received via email. All existing sessions are revoked.',
    })
    @ApiBody({ type: ResetPasswordDto })
    @ApiOkResponse({
        type: MessageResponseEntity,
        description: 'Password reset successfully',
    })
    @ApiBadRequestResponse({
        description: 'Invalid/expired code or too many failed attempts',
    })
    async resetPassword(@Body() dto: ResetPasswordDto) {
        return await this.authService.resetPassword(dto);
    }

    @Post('login')
    @Public()
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { ttl: 60000, limit: 5 } })
    @ApiOperation({
        summary: 'Login with email and password',
        description:
            'Authenticates a user with email and password. Only users with verified emails can log in.',
    })
    @ApiBody({ type: LoginDto })
    @ApiOkResponse({
        type: AuthResponseEntity,
        description: 'Login successful',
    })
    @ApiBadRequestResponse({ description: 'Validation failed' })
    @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
    @ApiForbiddenResponse({
        description: 'Account is deactivated or email not verified',
    })
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
