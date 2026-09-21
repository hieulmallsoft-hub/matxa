import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../database/prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';
import { AccessTokenGuard } from '../guards/access-token.guard';

jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

describe('Auth HTTP contracts (mocked business service, real validation and guard)', () => {
  let app: INestApplication;
  let base: string;
  const deviceId = 'test-device';
  const rows: [string, string, object, number][] = [
    ['register/start', 'sendEmailOtp', { email: 'test@example.com', deviceId }, 202],
    ['register/verify-otp', 'verifyRegistrationOtp', { registrationSessionId: 'session', code: '123456', deviceId }, 200],
    ['register/complete', 'completeEmailRegistration', { registrationSessionId: 'session', password: 'password123', deviceId }, 200],
    ['email/login', 'loginWithEmail', { email: 'test@example.com', password: 'password123', deviceId }, 200],
    ['password/forgot/start', 'startPasswordReset', { email: 'test@example.com', deviceId }, 202],
    ['password/forgot/verify-otp', 'verifyPasswordResetOtp', { passwordResetSessionId: 'session', code: '123456', deviceId }, 200],
    ['password/forgot/complete', 'completePasswordReset', { passwordResetSessionId: 'session', newPassword: 'password123', deviceId }, 200],
    ['google', 'loginWithGoogle', { idToken: 'test-token', deviceId }, 200],
    ['apple/start', 'startAppleLogin', {}, 200],
    ['apple', 'loginWithApple', { idToken: 'test-token', nonce: 'nonce', deviceId }, 200],
    ['refresh', 'refresh', { refreshToken: 'session.secret' }, 200],
  ];
  const service = Object.fromEntries([...rows.map((row) => row[1]), 'getCurrentUser', 'logout', 'logoutAll'].map((name) => [name, jest.fn().mockResolvedValue({ ok: true })]));
  const session = { findFirst: jest.fn().mockResolvedValue({ id: 'session' }) };
  const jwt = new JwtService({ secret: 'test-secret-for-auth-http-contracts' });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [AccessTokenGuard, { provide: AuthService, useValue: service },
        { provide: JwtService, useValue: jwt }, { provide: PrismaService, useValue: { session } }],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    base = `${await app.getUrl()}/api/auth`;
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => { jest.clearAllMocks(); session.findFirst.mockResolvedValue({ id: 'session' }); });

  it.each(rows)('POST %s accepts its documented body', async (path, method, body, status) => {
    const response = await fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    expect(response.status).toBe(status);
    expect(service[method]).toHaveBeenCalledTimes(1);
  });
  it.each(rows.filter((row) => row[0] !== 'apple/start'))('POST %s rejects missing required input', async (path, method) => {
    const response = await fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(response.status).toBe(400);
    expect(service[method]).not.toHaveBeenCalled();
  });
  it.each([['me', 'GET', 'getCurrentUser', 200], ['logout', 'POST', 'logout', 204], ['logout-all', 'POST', 'logoutAll', 204]] as const)(
    '%s requires a valid active session', async (path, method, serviceMethod, status) => {
      expect((await fetch(`${base}/${path}`, { method })).status).toBe(401);
      expect((await fetch(`${base}/${path}`, { method, headers: { Authorization: 'Bearer invalid' } })).status).toBe(401);
      const token = jwt.sign({ sub: 'user', sid: 'session' });
      const headers = { Authorization: `Bearer ${token}` };
      expect((await fetch(`${base}/${path}`, { method, headers })).status).toBe(status);
      expect(service[serviceMethod]).toHaveBeenCalledTimes(1);
      session.findFirst.mockResolvedValueOnce(null);
      expect((await fetch(`${base}/${path}`, { method, headers })).status).toBe(401);
    });
});
