import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../redis/redis.service';
import { SmsProvider } from '../sms/sms-provider.interface';
import { PhoneOtpService } from './phone-otp.service';

describe('PhoneOtpService', () => {
  const redisClient = {
    set: jest.fn(),
    del: jest.fn(),
    get: jest.fn(),
    eval: jest.fn(),
  };
  const smsProvider: SmsProvider = { sendOtp: jest.fn() };
  const values: Record<string, string | number> = {
    OTP_SECRET: 'o'.repeat(32),
    OTP_TTL_SECONDS: 300,
    OTP_RESEND_SECONDS: 60,
    OTP_MAX_ATTEMPTS: 5,
    OTP_PHONE_LIMIT_PER_HOUR: 5,
    OTP_IP_LIMIT_PER_HOUR: 20,
    OTP_DEVICE_LIMIT_PER_HOUR: 10,
    SMS_PROVIDER: 'development',
    SMS_DEV_CODE: '123456',
  };
  const config = {
    get: jest.fn((key: string, fallback: unknown) => values[key] ?? fallback),
    getOrThrow: jest.fn((key: string) => values[key]),
  };
  let service: PhoneOtpService;

  beforeEach(() => {
    jest.clearAllMocks();
    redisClient.set.mockResolvedValue('OK');
    redisClient.eval.mockResolvedValue(1);
    service = new PhoneOtpService(
      { client: redisClient } as unknown as RedisService,
      smsProvider,
      config as unknown as ConfigService,
    );
  });

  it('normalizes a Vietnamese phone and returns only a development OTP', async () => {
    const response = await service.sendOtp(
      '0394 338 212',
      'android-device-1',
      '127.0.0.1',
    );

    expect(smsProvider.sendOtp).toHaveBeenCalledWith('+84394338212', '123456');
    expect(response.debugOtp).toBe('123456');
    const challengeCall = redisClient.set.mock.calls.find(([key]) =>
      String(key).startsWith('otp:challenge:'),
    );
    expect(challengeCall?.[1]).not.toContain('"otpHash":"123456"');
  });

  it('rejects resend during the cooldown window', async () => {
    redisClient.set.mockResolvedValueOnce(null);

    await expect(
      service.sendOtp('0394338212', 'android-device-1', '127.0.0.1'),
    ).rejects.toMatchObject({ status: 429 });
  });
});
