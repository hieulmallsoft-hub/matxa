import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { App } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { PrismaService } from '../../../database/prisma.service';
import {
  AuthProvider as DbAuthProvider,
  User,
  UserIdentity,
} from '../../../generated/prisma/client';
import { FIREBASE_ADMIN } from '../firebase/firebase-admin.provider';
import { AccessTokenPayload } from '../models/access-token-payload.model';
import { ClientMetadata } from '../models/auth-request.model';
import { SendPhoneOtpResponse } from '../models/phone-otp.model';
import {
  AuthProvider,
  AuthResponse,
  AuthUser,
} from '../models/auth-user.model';
import { PhoneOtpService } from './phone-otp.service';

type UserWithIdentities = User & { identities: UserIdentity[] };

@Injectable()
export class AuthService {
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenTtlDays: number;
  private readonly refreshTokenPepper: string;

  constructor(
    @Inject(FIREBASE_ADMIN) private readonly firebaseApp: App,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly phoneOtpService: PhoneOtpService,
    config: ConfigService,
  ) {
    this.accessTokenExpiresIn = config.get('JWT_EXPIRES_IN', '15m');
    this.refreshTokenTtlDays = config.get<number>('REFRESH_TOKEN_TTL_DAYS', 30);
    this.refreshTokenPepper = config.getOrThrow<string>('REFRESH_TOKEN_PEPPER');
  }

  sendPhoneOtp(
    phoneNumber: string,
    deviceId: string,
    ipAddress: string,
  ): Promise<SendPhoneOtpResponse> {
    return this.phoneOtpService.sendOtp(phoneNumber, deviceId, ipAddress);
  }

  async verifyPhoneOtp(
    challengeId: string,
    code: string,
    metadata: ClientMetadata & { deviceId: string },
  ): Promise<AuthResponse> {
    const phoneNumber = await this.phoneOtpService.verifyOtp(
      challengeId,
      code,
      metadata.deviceId,
    );
    const user = await this.upsertPhoneUser(phoneNumber);
    return this.createSession(user, metadata, 'phone');
  }

  async loginWithGoogle(
    idToken: string,
    metadata: ClientMetadata,
  ): Promise<AuthResponse> {
    const token = await this.verifyFirebaseToken(idToken, 'google.com');
    const user = await this.upsertGoogleUser(token);
    return this.createSession(user, metadata, 'google.com');
  }

  async refresh(
    refreshToken: string,
    metadata: ClientMetadata,
  ): Promise<AuthResponse> {
    const { sessionId, secret } = this.parseRefreshToken(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: { include: { identities: true } } },
    });

    if (!session || !this.matchesRefreshSecret(secret, session.refreshTokenHash)) {
      throw new UnauthorizedException('Refresh token khong hop le');
    }

    if (session.revokedAt) {
      await this.prisma.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Phat hien refresh token da duoc su dung lai');
    }

    if (session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Phien dang nhap da het han');
    }

    const nextSessionId = randomUUID();
    const nextSecret = randomBytes(32).toString('base64url');

    await this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.session.updateMany({
        where: { id: session.id, revokedAt: null },
        data: {
          revokedAt: new Date(),
          lastUsedAt: new Date(),
          replacedById: nextSessionId,
        },
      });

      if (revoked.count !== 1) {
        throw new UnauthorizedException('Refresh token da duoc su dung');
      }

      await transaction.session.create({
        data: {
          id: nextSessionId,
          userId: session.userId,
          refreshTokenHash: this.hashRefreshSecret(nextSecret),
          deviceId: metadata.deviceId ?? session.deviceId,
          userAgent: metadata.userAgent,
          ipAddress: metadata.ipAddress,
          expiresAt: this.getRefreshExpiry(),
        },
      });
    });

    return this.buildAuthResponse(session.user, nextSessionId, nextSecret);
  }

  async getCurrentUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { identities: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tai khoan khong con hoat dong');
    }

    return this.toAuthUser(user);
  }

  async logout(sessionId: string, userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createSession(
    user: UserWithIdentities,
    metadata: ClientMetadata,
    preferredProvider: AuthProvider,
  ): Promise<AuthResponse> {
    const sessionId = randomUUID();
    const secret = randomBytes(32).toString('base64url');

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: this.hashRefreshSecret(secret),
        deviceId: metadata.deviceId,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
        expiresAt: this.getRefreshExpiry(),
      },
    });

    return this.buildAuthResponse(user, sessionId, secret, preferredProvider);
  }

  private async verifyFirebaseToken(
    idToken: string,
    expectedProvider: AuthProvider,
  ): Promise<DecodedIdToken> {
    let token: DecodedIdToken;
    try {
      token = await getAuth(this.firebaseApp).verifyIdToken(idToken, true);
    } catch {
      throw new UnauthorizedException('Firebase ID token khong hop le');
    }

    if (token.firebase.sign_in_provider !== expectedProvider) {
      throw new UnauthorizedException('Phuong thuc dang nhap khong hop le');
    }
    return token;
  }

  private async upsertGoogleUser(
    token: DecodedIdToken,
  ): Promise<UserWithIdentities> {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.userIdentity.findUnique({
        where: {
          provider_providerSubject: {
            provider: DbAuthProvider.GOOGLE,
            providerSubject: token.uid,
          },
        },
      });

      const linkedIdentity = existing
        ? null
        : await transaction.userIdentity.findFirst({
            where: { providerSubject: token.uid },
            select: { userId: true },
          });
      let userId = existing?.userId ?? linkedIdentity?.userId;

      if (!userId) {
        const created = await transaction.user.create({
          data: { displayName: token.name, avatarUrl: token.picture },
        });
        userId = created.id;
      }

      await transaction.userIdentity.upsert({
        where: {
          provider_providerSubject: {
            provider: DbAuthProvider.GOOGLE,
            providerSubject: token.uid,
          },
        },
        create: {
          userId,
          provider: DbAuthProvider.GOOGLE,
          providerSubject: token.uid,
          phoneNumber: token.phone_number,
          email: token.email,
          emailVerified: token.email_verified ?? false,
        },
        update: {
          phoneNumber: token.phone_number,
          email: token.email,
          emailVerified: token.email_verified ?? false,
        },
      });

      return transaction.user.update({
        where: { id: userId },
        data: {
          ...(token.name ? { displayName: token.name } : {}),
          ...(token.picture ? { avatarUrl: token.picture } : {}),
        },
        include: { identities: true },
      });
    });
  }

  private async upsertPhoneUser(
    phoneNumber: string,
  ): Promise<UserWithIdentities> {
    return this.prisma.$transaction(async (transaction) => {
      const identity = await transaction.userIdentity.findUnique({
        where: {
          provider_providerSubject: {
            provider: DbAuthProvider.PHONE,
            providerSubject: phoneNumber,
          },
        },
      });

      let userId = identity?.userId;
      if (!userId) {
        const user = await transaction.user.create({ data: {} });
        userId = user.id;
        await transaction.userIdentity.create({
          data: {
            userId,
            provider: DbAuthProvider.PHONE,
            providerSubject: phoneNumber,
            phoneNumber,
          },
        });
      } else if (identity) {
        await transaction.userIdentity.update({
          where: { id: identity.id },
          data: { phoneNumber },
        });
      }

      return transaction.user.findUniqueOrThrow({
        where: { id: userId },
        include: { identities: true },
      });
    });
  }

  private async buildAuthResponse(
    user: UserWithIdentities,
    sessionId: string,
    refreshSecret: string,
    preferredProvider?: AuthProvider,
  ): Promise<AuthResponse> {
    const payload: AccessTokenPayload = { sub: user.id, sid: sessionId };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      refreshToken: `${sessionId}.${refreshSecret}`,
      tokenType: 'Bearer',
      expiresIn: this.accessTokenExpiresIn,
      user: this.toAuthUser(user, preferredProvider),
    };
  }

  private toAuthUser(
    user: UserWithIdentities,
    preferredProvider?: AuthProvider,
  ): AuthUser {
    const identity = preferredProvider
      ? user.identities.find((item) =>
          preferredProvider === 'phone'
            ? item.provider === DbAuthProvider.PHONE
            : item.provider === DbAuthProvider.GOOGLE,
        )
      : user.identities[0];
    const provider: AuthProvider =
      identity?.provider === DbAuthProvider.PHONE ? 'phone' : 'google.com';

    return {
      id: user.id,
      provider,
      ...(identity?.phoneNumber ? { phoneNumber: identity.phoneNumber } : {}),
      ...(identity?.email ? { email: identity.email } : {}),
      ...(user.displayName ? { name: user.displayName } : {}),
      ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
    };
  }

  private parseRefreshToken(token: string): { sessionId: string; secret: string } {
    const separator = token.indexOf('.');
    if (separator < 1 || separator === token.length - 1) {
      throw new UnauthorizedException('Refresh token khong hop le');
    }
    return { sessionId: token.slice(0, separator), secret: token.slice(separator + 1) };
  }

  private hashRefreshSecret(secret: string): string {
    return createHmac('sha256', this.refreshTokenPepper).update(secret).digest('hex');
  }

  private matchesRefreshSecret(secret: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hashRefreshSecret(secret), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private getRefreshExpiry(): Date {
    return new Date(Date.now() + this.refreshTokenTtlDays * 86_400_000);
  }
}
