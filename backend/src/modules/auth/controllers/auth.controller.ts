import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentAuth } from '../decorators/current-auth.decorator';
import { FirebaseLoginDto } from '../dto/firebase-login.dto';
import { EmailLoginDto } from '../dto/email-login.dto';
import { CompleteRegistrationDto } from '../dto/complete-registration.dto';
import { VerifyRegistrationOtpDto } from '../dto/verify-registration-otp.dto';
import { CompletePasswordResetDto } from '../dto/complete-password-reset.dto';
import { VerifyPasswordResetOtpDto } from '../dto/verify-password-reset-otp.dto';
import { SendEmailOtpDto } from '../dto/send-email-otp.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { SendPhoneOtpDto } from '../dto/send-phone-otp.dto';
import { VerifyPhoneOtpDto } from '../dto/verify-phone-otp.dto';
import { AccessTokenGuard } from '../guards/access-token.guard';
import { AccessTokenPayload } from '../models/access-token-payload.model';
import { ClientMetadata } from '../models/auth-request.model';
import { AuthResponse, AuthUser } from '../models/auth-user.model';
import { SendPhoneOtpResponse } from '../models/phone-otp.model';
import { SendEmailOtpResponse, VerifyRegistrationOtpResponse } from '../models/email-otp.model';
import { CompletePasswordResetResponse, StartPasswordResetResponse, VerifyPasswordResetResponse } from '../models/password-reset.model';
import { AuthService } from '../services/auth.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/start')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Gui OTP xac minh email de dang ky' })
  @ApiAcceptedResponse({ type: SendEmailOtpResponse })
  sendEmailOtp(@Body() dto: SendEmailOtpDto): Promise<SendEmailOtpResponse> {
    return this.authService.sendEmailOtp(dto.email, dto.deviceId);
  }

  @Post('register/verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Xac minh OTP cua phien dang ky' })
  @ApiOkResponse({ type: VerifyRegistrationOtpResponse })
  verifyRegistrationOtp(@Body() dto: VerifyRegistrationOtpDto): Promise<VerifyRegistrationOtpResponse> {
    return this.authService.verifyRegistrationOtp(dto.registrationSessionId, dto.code, dto.deviceId);
  }

  @Post('register/complete')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Tao mat khau va hoan tat dang ky' })
  @ApiOkResponse({ type: AuthResponse })
  completeRegistration(@Body() dto: CompleteRegistrationDto, @Req() request: Request): Promise<AuthResponse> {
    return this.authService.completeEmailRegistration(dto.registrationSessionId, dto.password, {
      ...this.getClientMetadata(request, dto.deviceId), deviceId: dto.deviceId,
    });
  }

  @Post('email/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Dang nhap bang email va mat khau' })
  @ApiOkResponse({ type: AuthResponse })
  loginEmail(@Body() dto: EmailLoginDto, @Req() request: Request): Promise<AuthResponse> {
    return this.authService.loginWithEmail(dto.email, dto.password, this.getClientMetadata(request, dto.deviceId));
  }

  @Post('password/forgot/start')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Gui OTP email de khoi phuc mat khau' })
  @ApiAcceptedResponse({ type: StartPasswordResetResponse })
  startPasswordReset(@Body() dto: SendEmailOtpDto): Promise<StartPasswordResetResponse> {
    return this.authService.startPasswordReset(dto.email, dto.deviceId);
  }

  @Post('password/forgot/verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Xac minh OTP khoi phuc mat khau' })
  @ApiOkResponse({ type: VerifyPasswordResetResponse })
  verifyPasswordReset(@Body() dto: VerifyPasswordResetOtpDto): Promise<VerifyPasswordResetResponse> {
    return this.authService.verifyPasswordResetOtp(dto.passwordResetSessionId, dto.code, dto.deviceId);
  }

  @Post('password/forgot/complete')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Dat mat khau moi sau khi xac minh OTP' })
  @ApiOkResponse({ type: CompletePasswordResetResponse })
  completePasswordReset(@Body() dto: CompletePasswordResetDto): Promise<CompletePasswordResetResponse> {
    return this.authService.completePasswordReset(dto.passwordResetSessionId, dto.newPassword, dto.deviceId);
  }

  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Gui OTP dang nhap den so dien thoai' })
  @ApiAcceptedResponse({ type: SendPhoneOtpResponse })
  @ApiBadRequestResponse({ description: 'So dien thoai khong hop le' })
  @ApiTooManyRequestsResponse({ description: 'Vuot gioi han gui OTP' })
  sendPhoneOtp(
    @Body() dto: SendPhoneOtpDto,
    @Req() request: Request,
  ): Promise<SendPhoneOtpResponse> {
    return this.authService.sendPhoneOtp(
      dto.phoneNumber,
      dto.deviceId,
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );
  }

  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Xac minh OTP va dang nhap' })
  @ApiOkResponse({ type: AuthResponse })
  @ApiUnauthorizedResponse({ description: 'OTP sai, het han hoac da dung' })
  verifyPhoneOtp(
    @Body() dto: VerifyPhoneOtpDto,
    @Req() request: Request,
  ): Promise<AuthResponse> {
    return this.authService.verifyPhoneOtp(dto.challengeId, dto.code, {
      ...this.getClientMetadata(request, dto.deviceId),
      deviceId: dto.deviceId,
    });
  }

  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('access-token')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Gui OTP de lien ket so dien thoai voi tai khoan' })
  @ApiAcceptedResponse({ type: SendPhoneOtpResponse })
  @ApiUnauthorizedResponse({ description: 'Can dang nhap truoc khi lien ket' })
  linkPhoneSendOtp(
    @CurrentAuth() auth: AccessTokenPayload,
    @Body() dto: SendPhoneOtpDto,
    @Req() request: Request,
  ): Promise<SendPhoneOtpResponse> {
    return this.authService.sendPhoneOtp(
      dto.phoneNumber,
      dto.deviceId,
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
      auth.sub,
    );
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('access-token')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Xac minh OTP va lien ket so dien thoai' })
  @ApiOkResponse({ type: AuthUser })
  @ApiUnauthorizedResponse({ description: 'OTP hoac access token khong hop le' })
  linkPhoneVerifyOtp(
    @CurrentAuth() auth: AccessTokenPayload,
    @Body() dto: VerifyPhoneOtpDto,
  ): Promise<AuthUser> {
    return this.authService.linkVerifiedPhone(
      auth.sub,
      dto.challengeId,
      dto.code,
      dto.deviceId,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Dang nhap so dien thoai qua Firebase Phone Auth' })
  @ApiOkResponse({ type: AuthResponse })
  @ApiUnauthorizedResponse({
    description: 'Firebase token khong hop le hoac khong phai Phone Auth',
  })
  loginWithFirebasePhone(
    @Body() dto: FirebaseLoginDto,
    @Req() request: Request,
  ): Promise<AuthResponse> {
    return this.authService.loginWithFirebasePhone(
      dto.idToken,
      this.getClientMetadata(request, dto.deviceId),
    );
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Dang ky hoac dang nhap bang Google ID token' })
  @ApiOkResponse({ type: AuthResponse })
  @ApiUnauthorizedResponse({ description: 'Google ID token khong hop le' })
  loginWithGoogle(
    @Body() dto: FirebaseLoginDto,
    @Req() request: Request,
  ): Promise<AuthResponse> {
    return this.authService.loginWithGoogle(
      dto.idToken,
      this.getClientMetadata(request, dto.deviceId),
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Xoay refresh token va lay cap token moi' })
  @ApiOkResponse({ type: AuthResponse })
  @ApiUnauthorizedResponse({ description: 'Refresh token khong hop le' })
  refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
  ): Promise<AuthResponse> {
    return this.authService.refresh(
      dto.refreshToken,
      this.getClientMetadata(request),
    );
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Lay thong tin tai khoan hien tai' })
  @ApiOkResponse({ type: AuthUser })
  @ApiUnauthorizedResponse({ description: 'Access token khong hop le' })
  getMe(@CurrentAuth() auth: AccessTokenPayload): Promise<AuthUser> {
    return this.authService.getCurrentUser(auth.sub);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Dang xuat session hien tai' })
  @ApiNoContentResponse()
  logout(@CurrentAuth() auth: AccessTokenPayload): Promise<void> {
    return this.authService.logout(auth.sid, auth.sub);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Dang xuat khoi tat ca thiet bi' })
  @ApiNoContentResponse()
  logoutAll(@CurrentAuth() auth: AccessTokenPayload): Promise<void> {
    return this.authService.logoutAll(auth.sub);
  }

  private getClientMetadata(request: Request, deviceId?: string): ClientMetadata {
    return {
      deviceId,
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    };
  }
}
