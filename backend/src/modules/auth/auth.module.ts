import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { AuthController } from './controllers/auth.controller';
import { firebaseAdminProvider } from './firebase/firebase-admin.provider';
import { AccessTokenGuard } from './guards/access-token.guard';
import { DevelopmentSmsProvider } from './sms/development-sms.provider';
import { smsProviderFactory } from './sms/sms-provider.factory';
import { AuthService } from './services/auth.service';
import { GoogleTokenVerifierService } from './services/google-token-verifier.service';
import { PhoneOtpService } from './services/phone-otp.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN', '7d'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    firebaseAdminProvider,
    DevelopmentSmsProvider,
    smsProviderFactory,
    PhoneOtpService,
    GoogleTokenVerifierService,
    AuthService,
    AccessTokenGuard,
  ],
  exports: [JwtModule],
})
export class AuthModule {}
