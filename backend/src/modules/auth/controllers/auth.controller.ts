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
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { SendPhoneOtpDto } from '../dto/send-phone-otp.dto';
import { VerifyPhoneOtpDto } from '../dto/verify-phone-otp.dto';
import { AccessTokenGuard } from '../guards/access-token.guard';
import { AccessTokenPayload } from '../models/access-token-payload.model';
import { ClientMetadata } from '../models/auth-request.model';
import { AuthResponse, AuthUser } from '../models/auth-user.model';
import { SendPhoneOtpResponse } from '../models/phone-otp.model';
import { AuthService } from '../services/auth.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('phone/send-otp')
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

  @Post('phone/verify-otp')
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

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Dang nhap bang Google qua Firebase' })
  @ApiOkResponse({ type: AuthResponse })
  @ApiUnauthorizedResponse({ description: 'Firebase token khong hop le' })
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
