import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { RedisService } from '../../../redis/redis.service';
import { SendEmailOtpResponse } from '../models/email-otp.model';

type EmailChallenge = { email: string; deviceId: string; otpHash: string; attempts: number };

@Injectable()
export class EmailOtpService {
  private readonly logger = new Logger(EmailOtpService.name);
  private readonly secret: string;
  private readonly ttl: number;
  private readonly development: boolean;

  constructor(private readonly redis: RedisService, config: ConfigService) {
    this.secret = config.getOrThrow<string>('OTP_SECRET');
    this.ttl = config.get<number>('OTP_TTL_SECONDS', 300);
    this.development = config.get('EMAIL_PROVIDER', 'development') === 'development';
  }

  async sendOtp(input: string, deviceId: string): Promise<SendEmailOtpResponse> {
    const email = input.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Email khong hop le');
    const limitKey = `email-otp:limit:${this.hash(email)}`;
    const count = await this.redis.client.incr(limitKey);
    if (count === 1) await this.redis.client.expire(limitKey, 3600);
    if (count > 5) throw new HttpException('Vuot gioi han gui OTP email', HttpStatus.TOO_MANY_REQUESTS);

    const challengeId = randomUUID();
    const code = this.development ? '123456' : randomInt(100000, 1000000).toString();
    const challenge: EmailChallenge = { email, deviceId, otpHash: this.hash(`${challengeId}:${code}`), attempts: 0 };
    await this.redis.client.set(`email-otp:challenge:${challengeId}`, JSON.stringify(challenge), { EX: this.ttl });

    // Development provider. Replace this branch with SMTP/Resend when credentials are supplied.
    if (this.development) this.logger.warn(`Development email OTP for ${email}: ${code}`);
    else throw new Error('EMAIL_PROVIDER chua duoc cau hinh');
    return { challengeId, expiresIn: this.ttl, ...(this.development ? { debugOtp: code } : {}) };
  }

  async verifyOtp(challengeId: string, code: string, deviceId: string): Promise<string> {
    const key = `email-otp:challenge:${challengeId}`;
    const raw = await this.redis.client.get(key);
    if (!raw) throw new UnauthorizedException('OTP sai hoac da het han');
    const challenge = JSON.parse(raw) as EmailChallenge;
    if (challenge.deviceId !== deviceId) throw new UnauthorizedException('Thiet bi xac minh khong hop le');
    if (challenge.attempts >= 5) { await this.redis.client.del(key); throw new UnauthorizedException('Da vuot so lan nhap OTP'); }
    if (challenge.otpHash !== this.hash(`${challengeId}:${code}`)) {
      challenge.attempts += 1;
      await this.redis.client.set(key, JSON.stringify(challenge), { KEEPTTL: true });
      throw new UnauthorizedException('OTP khong hop le');
    }
    await this.redis.client.del(key);
    return challenge.email;
  }

  private hash(value: string): string { return createHmac('sha256', this.secret).update(value).digest('hex'); }
}
