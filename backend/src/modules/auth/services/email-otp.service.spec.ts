import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { RedisService } from '../../../redis/redis.service';
import { EmailOtpService } from './email-otp.service';

describe('Email OTP (in-memory Redis, mocked SMTP)', () => {
  const values = new Map<string, string>();
  const redis = { client: {
    incr: jest.fn(async (key: string) => { const n = Number(values.get(key) ?? 0) + 1; values.set(key, String(n)); return n; }),
    expire: jest.fn(),
    set: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    get: jest.fn(async (key: string) => values.get(key) ?? null),
    del: jest.fn(async (key: string) => Number(values.delete(key))),
    getDel: jest.fn(async (key: string) => { const value = values.get(key) ?? null; values.delete(key); return value; }),
  } };
  function make(provider = 'development') {
    const settings: Record<string, unknown> = { EMAIL_PROVIDER: provider, OTP_SECRET: 'test-secret', OTP_TTL_SECONDS: 300,
      SMTP_FROM: 'test@example.com', SMTP_HOST: 'smtp.example.com', SMTP_USER: 'test', SMTP_PASS: 'test' };
    const config = { get: (key: string, fallback: unknown) => settings[key] ?? fallback, getOrThrow: (key: string) => settings[key] };
    return new EmailOtpService(redis as unknown as RedisService, config as unknown as ConfigService);
  }
  beforeEach(() => { values.clear(); jest.clearAllMocks(); });
  afterEach(() => jest.restoreAllMocks());
  it('development mode returns a debug code and does not send mail', async () => {
    const transport = jest.spyOn(nodemailer, 'createTransport');
    const service = make();
    const result = await service.sendOtp('User@example.com', 'device');
    expect(result.debugOtp).toBe('123456');
    expect(transport).not.toHaveBeenCalled();
    expect(await service.verifyRegistration(result.registrationSessionId, '123456', 'device')).toBe(600);
    expect(await service.consumeVerifiedRegistration(result.registrationSessionId, 'device')).toBe('user@example.com');
    await expect(service.consumeVerifiedRegistration(result.registrationSessionId, 'device')).rejects.toThrow();
  });
  it('rejects wrong device, purpose, code, and exhausted attempts', async () => {
    const service = make();
    const { registrationSessionId: id } = await service.sendOtp('user@example.com', 'device');
    await expect(service.verifyRegistration(id, '123456', 'wrong')).rejects.toThrow();
    await expect(service.verifyPasswordReset(id, '123456', 'device')).rejects.toThrow();
    for (let i = 0; i < 5; i++) await expect(service.verifyRegistration(id, '000000', 'device')).rejects.toThrow();
    await expect(service.verifyRegistration(id, '123456', 'device')).rejects.toThrow();
  });
  it('supports password reset verification and one-time completion', async () => {
    const service = make();
    const { registrationSessionId: id } = await service.sendOtp('user@example.com', 'device', 'password-reset');
    await expect(service.consumeVerifiedPasswordReset(id, 'device')).rejects.toThrow();
    await service.verifyPasswordReset(id, '123456', 'device');
    expect(await service.consumeVerifiedPasswordReset(id, 'device')).toBe('user@example.com');
    await expect(service.consumeVerifiedPasswordReset(id, 'device')).rejects.toThrow();
  });
  it('limits email sends to five per hour', async () => {
    const service = make();
    for (let i = 0; i < 5; i++) await service.sendOtp('user@example.com', 'device');
    await expect(service.sendOtp('user@example.com', 'device')).rejects.toThrow('Vuot gioi han');
  });
  it('sends SMTP mail and does not return debugOtp', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail } as never);
    const result = await make('smtp').sendOtp('user@example.com', 'device');
    expect(result.debugOtp).toBeUndefined();
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'user@example.com' }));
  });
  it('removes the challenge when SMTP fails', async () => {
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: jest.fn().mockRejectedValue(new Error('SMTP unavailable')) } as never);
    await expect(make('smtp').sendOtp('user@example.com', 'device')).rejects.toThrow('Khong the gui email');
    expect([...values.keys()].some((key) => key.startsWith('email-otp:challenge:'))).toBe(false);
  });
});
