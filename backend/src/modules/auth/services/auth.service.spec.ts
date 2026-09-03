import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getAuth } from 'firebase-admin/auth';
import { PrismaService } from '../../../database/prisma.service';
import { AuthService } from './auth.service';

jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

describe('AuthService', () => {
  const transaction = {
    userIdentity: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
    user: {
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(transaction)),
    session: { create: jest.fn() },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('access-token') };
  const config = {
    get: jest.fn((key: string, fallback: unknown) => {
      if (key === 'JWT_EXPIRES_IN') return '15m';
      if (key === 'REFRESH_TOKEN_TTL_DAYS') return 30;
      return fallback;
    }),
    getOrThrow: jest.fn().mockReturnValue('a'.repeat(32)),
  };
  const verifyIdToken = jest.fn();
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    (getAuth as jest.Mock).mockReturnValue({ verifyIdToken });
    transaction.userIdentity.findUnique.mockResolvedValue(null);
    transaction.userIdentity.findFirst.mockResolvedValue(null);
    transaction.user.create.mockResolvedValue({ id: 'user-id' });
    transaction.user.update.mockResolvedValue({
      id: 'user-id',
      displayName: 'Matxa User',
      avatarUrl: null,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      identities: [
        {
          provider: 'PHONE',
          phoneNumber: '+84901234567',
          email: null,
        },
      ],
    });
    service = new AuthService(
      {} as never,
      jwt as unknown as JwtService,
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
    );
  });

  it('creates a local session after a valid phone login', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'firebase-user-id',
      phone_number: '+84901234567',
      firebase: { sign_in_provider: 'phone' },
    });

    const result = await service.loginWithPhone('firebase-token', {
      deviceId: 'device-1',
    });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toContain('.');
    expect(result.user.id).toBe('user-id');
    expect(prisma.session.create).toHaveBeenCalledTimes(1);
    expect(prisma.session.create.mock.calls[0][0].data.refreshTokenHash)
      .toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects a Google token on the phone endpoint', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'firebase-user-id',
      firebase: { sign_in_provider: 'google.com' },
    });

    await expect(service.loginWithPhone('firebase-token', {})).rejects.toThrow(
      'Phuong thuc dang nhap khong hop le',
    );
  });
});
