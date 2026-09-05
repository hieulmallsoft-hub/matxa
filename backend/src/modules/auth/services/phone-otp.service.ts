import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { RedisService } from '../../../redis/redis.service';
import { SendPhoneOtpResponse } from '../models/phone-otp.model';
import { SMS_PROVIDER, SmsProvider } from '../sms/sms-provider.interface';

interface OtpChallenge {
  phoneNumber: string;
  phoneHash: string;
  deviceHash: string;
  otpHash: string;
  attempts: number;
  bindingHash?: string;
}

@Injectable()
export class PhoneOtpService {
  private readonly secret: string;
  private readonly ttlSeconds: number;
  private readonly resendSeconds: number;
  private readonly maxAttempts: number;
  private readonly phoneLimit: number;
  private readonly ipLimit: number;
  private readonly deviceLimit: number;
  private readonly isDevelopmentSms: boolean;
  private readonly developmentCode: string;

  constructor(
    private readonly redis: RedisService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
    config: ConfigService,
  ) {
    this.secret = config.getOrThrow<string>('OTP_SECRET');
    this.ttlSeconds = config.get<number>('OTP_TTL_SECONDS', 300);
    this.resendSeconds = config.get<number>('OTP_RESEND_SECONDS', 60);
    this.maxAttempts = config.get<number>('OTP_MAX_ATTEMPTS', 5);
    this.phoneLimit = config.get<number>('OTP_PHONE_LIMIT_PER_HOUR', 5);
    this.ipLimit = config.get<number>('OTP_IP_LIMIT_PER_HOUR', 20);
    this.deviceLimit = config.get<number>('OTP_DEVICE_LIMIT_PER_HOUR', 10);
    this.isDevelopmentSms =
      config.get('SMS_PROVIDER', 'development') === 'development';
    this.developmentCode = config.get('SMS_DEV_CODE', '123456');

    if (!/^\d{6}$/.test(this.developmentCode)) {
      throw new Error('SMS_DEV_CODE phai gom dung 6 chu so');
    }
  }

  async sendOtp(
    phoneInput: string,
    deviceId: string,
    ipAddress: string,
    binding?: string,
  ): Promise<SendPhoneOtpResponse> {
    const phoneNumber = this.normalizePhoneNumber(phoneInput);
    const phoneHash = this.hmac(`phone:${phoneNumber}`);
    const deviceHash = this.hmac(`device:${deviceId}`);
    const ipHash = this.hmac(`ip:${ipAddress}`);

    const cooldownCreated = await this.redis.client.set(
      `otp:cooldown:${phoneHash}`,
      '1',
      { EX: this.resendSeconds, NX: true },
    );
    if (!cooldownCreated) {
      this.tooManyRequests('Vui long cho truoc khi gui lai ma');
    }

    await Promise.all([
      this.enforceWindowLimit(`otp:limit:phone:${phoneHash}`, this.phoneLimit),
      this.enforceWindowLimit(`otp:limit:ip:${ipHash}`, this.ipLimit),
      this.enforceWindowLimit(`otp:limit:device:${deviceHash}`, this.deviceLimit),
    ]);

    const challengeId = randomUUID();
    const code = this.isDevelopmentSms
      ? this.developmentCode
      : randomInt(0, 1_000_000).toString().padStart(6, '0');
    const challenge: OtpChallenge = {
      phoneNumber,
      phoneHash,
      deviceHash,
      otpHash: this.hmac(`otp:${challengeId}:${code}`),
      attempts: 0,
      ...(binding ? { bindingHash: this.hmac(`binding:${binding}`) } : {}),
    };
    const challengeKey = `otp:challenge:${challengeId}`;

    await this.redis.client.set(challengeKey, JSON.stringify(challenge), {
      EX: this.ttlSeconds,
    });

    try {
      await this.smsProvider.sendOtp(phoneNumber, code);
    } catch {
      await this.redis.client.del(challengeKey);
      throw new HttpException(
        'Khong the gui ma xac minh luc nay',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      challengeId,
      expiresIn: this.ttlSeconds,
      resendAfter: this.resendSeconds,
      ...(this.isDevelopmentSms ? { debugOtp: code } : {}),
    };
  }

  async verifyOtp(
    challengeId: string,
    code: string,
    deviceId: string,
    binding?: string,
  ): Promise<string> {
    const challengeKey = `otp:challenge:${challengeId}`;
    const rawChallenge = await this.redis.client.get(challengeKey);
    if (!rawChallenge) {
      throw new UnauthorizedException('Ma xac minh khong hop le hoac da het han');
    }

    const challenge = JSON.parse(rawChallenge) as OtpChallenge;
    const result = (await this.redis.client.eval(VERIFY_OTP_SCRIPT, {
      keys: [challengeKey, `otp:fail:${challenge.phoneHash}`],
      arguments: [
        this.hmac(`otp:${challengeId}:${code}`),
        this.hmac(`device:${deviceId}`),
        this.maxAttempts.toString(),
        '3600',
        binding ? this.hmac(`binding:${binding}`) : '',
      ],
    })) as number;

    if (result !== 1) {
      throw new UnauthorizedException('Ma xac minh khong hop le hoac da het han');
    }

    return challenge.phoneNumber;
  }

  private normalizePhoneNumber(input: string): string {
    const compact = input.replace(/[\s()-]/g, '');
    const phone = parsePhoneNumberFromString(compact, 'VN');
    if (!phone?.isValid()) {
      throw new BadRequestException('So dien thoai khong hop le');
    }
    return phone.number;
  }

  private async enforceWindowLimit(key: string, limit: number): Promise<void> {
    const count = (await this.redis.client.eval(INCREMENT_WINDOW_SCRIPT, {
      keys: [key],
      arguments: ['3600'],
    })) as number;
    if (count > limit) {
      this.tooManyRequests('Da vuot qua gioi han gui ma');
    }
  }

  private hmac(value: string): string {
    return createHmac('sha256', this.secret).update(value).digest('hex');
  }

  private tooManyRequests(message: string): never {
    throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

const INCREMENT_WINDOW_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`;

const VERIFY_OTP_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local challenge = cjson.decode(raw)
if challenge.deviceHash ~= ARGV[2] then return -3 end
if (challenge.bindingHash or '') ~= ARGV[5] then return -4 end
local totalFailures = tonumber(redis.call('GET', KEYS[2]) or '0')
if totalFailures >= tonumber(ARGV[3]) then return -2 end
if tonumber(challenge.attempts) >= tonumber(ARGV[3]) then return -2 end
if challenge.otpHash ~= ARGV[1] then
  challenge.attempts = tonumber(challenge.attempts) + 1
  redis.call('SET', KEYS[1], cjson.encode(challenge), 'KEEPTTL')
  local failures = redis.call('INCR', KEYS[2])
  if failures == 1 then redis.call('EXPIRE', KEYS[2], ARGV[4]) end
  return -1
end
redis.call('DEL', KEYS[1])
return 1
`;
