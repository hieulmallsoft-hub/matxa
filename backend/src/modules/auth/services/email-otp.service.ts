import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { RedisService } from '../../../redis/redis.service';
import { SendEmailOtpResponse } from '../models/email-otp.model';
import nodemailer, { Transporter } from 'nodemailer';

type EmailOtpPurpose = 'registration' | 'password-reset';
type EmailChallenge = { email: string; deviceId: string; otpHash: string; attempts: number; purpose: EmailOtpPurpose };

@Injectable()
export class EmailOtpService {
  private readonly logger = new Logger(EmailOtpService.name);
  private readonly secret: string;
  private readonly ttl: number;
  private readonly development: boolean;
  private readonly transporter?: Transporter;
  private readonly from?: string;

  constructor(private readonly redis: RedisService, config: ConfigService) {
    this.secret = config.getOrThrow<string>('OTP_SECRET');
    this.ttl = config.get<number>('OTP_TTL_SECONDS', 300);
    this.development = config.get('EMAIL_PROVIDER', 'development') === 'development';
    if (!this.development) {
      this.from = config.getOrThrow<string>('SMTP_FROM');
      this.transporter = nodemailer.createTransport({
        host: config.getOrThrow<string>('SMTP_HOST'),
        port: Number(config.get('SMTP_PORT', 587)),
        secure: String(config.get('SMTP_SECURE', 'false')).toLowerCase() === 'true',
        auth: {
          user: config.getOrThrow<string>('SMTP_USER'),
          pass: config.getOrThrow<string>('SMTP_PASS'),
        },
      });
    }
  }

  async sendOtp(input: string, deviceId: string, purpose: EmailOtpPurpose = 'registration'): Promise<SendEmailOtpResponse> {
    const email = input.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Email khong hop le');
    const limitKey = `email-otp:limit:${this.hash(email)}`;
    const count = await this.redis.client.incr(limitKey);
    if (count === 1) await this.redis.client.expire(limitKey, 3600);
    if (count > 5) throw new HttpException('Vuot gioi han gui OTP email', HttpStatus.TOO_MANY_REQUESTS);

    const challengeId = randomUUID();
    const code = this.development ? '123456' : randomInt(100000, 1000000).toString();
    const challenge: EmailChallenge = { email, deviceId, otpHash: this.hash(`${challengeId}:${code}`), attempts: 0, purpose };
    await this.redis.client.set(`email-otp:challenge:${challengeId}`, JSON.stringify(challenge), { EX: this.ttl });

    if (this.development) {
      this.logger.warn(`Development email OTP for ${email}: ${code}`);
    } else {
      try {
        await this.transporter!.sendMail({
          from: this.from,
          to: email,
          subject: 'Ma xac minh tai khoan Matxa',
          text: `Ma xac minh Matxa cua ban la ${code}. Ma co hieu luc trong ${Math.ceil(this.ttl / 60)} phut. Khong chia se ma nay voi nguoi khac.`,
          html: `<p>Ma xac minh Matxa cua ban la:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>Ma co hieu luc trong ${Math.ceil(this.ttl / 60)} phut. Khong chia se ma nay voi nguoi khac.</p>`,
        });
      } catch (error) {
        await this.redis.client.del(`email-otp:challenge:${challengeId}`);
        this.logger.error('Khong the gui OTP email', error);
        throw new Error('Khong the gui email xac minh');
      }
    }
    return { registrationSessionId: challengeId, expiresIn: this.ttl, ...(this.development ? { debugOtp: code } : {}) };
  }

  async verifyOtp(challengeId: string, code: string, deviceId: string, purpose: EmailOtpPurpose): Promise<string> {
    const key = `email-otp:challenge:${challengeId}`;
    const raw = await this.redis.client.get(key);
    if (!raw) throw new UnauthorizedException('OTP sai hoac da het han');
    const challenge = JSON.parse(raw) as EmailChallenge;
    if (challenge.deviceId !== deviceId) throw new UnauthorizedException('Thiet bi xac minh khong hop le');
    if (challenge.purpose !== purpose) throw new UnauthorizedException('Phien OTP khong dung muc dich');
    if (challenge.attempts >= 5) { await this.redis.client.del(key); throw new UnauthorizedException('Da vuot so lan nhap OTP'); }
    if (challenge.otpHash !== this.hash(`${challengeId}:${code}`)) {
      challenge.attempts += 1;
      await this.redis.client.set(key, JSON.stringify(challenge), { KEEPTTL: true });
      throw new UnauthorizedException('OTP khong hop le');
    }
    await this.redis.client.del(key);
    return challenge.email;
  }

  async verifyRegistration(sessionId: string, code: string, deviceId: string): Promise<number> {
    const email = await this.verifyOtp(sessionId, code, deviceId, 'registration');
    const ttl = 600;
    await this.redis.client.set(
      `email-registration:verified:${sessionId}`,
      JSON.stringify({ email, deviceId }),
      { EX: ttl },
    );
    return ttl;
  }

  async consumeVerifiedRegistration(sessionId: string, deviceId: string): Promise<string> {
    const key = `email-registration:verified:${sessionId}`;
    const raw = await this.redis.client.getDel(key);
    if (!raw) throw new UnauthorizedException('Phien dang ky chua xac minh hoac da het han');
    const session = JSON.parse(raw) as { email: string; deviceId: string };
    if (session.deviceId !== deviceId) throw new UnauthorizedException('Thiet bi dang ky khong hop le');
    return session.email;
  }

  async verifyPasswordReset(sessionId: string, code: string, deviceId: string): Promise<number> {
    const email = await this.verifyOtp(sessionId, code, deviceId, 'password-reset');
    const ttl = 600;
    await this.redis.client.set(
      `email-password-reset:verified:${sessionId}`,
      JSON.stringify({ email, deviceId }),
      { EX: ttl },
    );
    return ttl;
  }

  async consumeVerifiedPasswordReset(sessionId: string, deviceId: string): Promise<string> {
    const raw = await this.redis.client.getDel(`email-password-reset:verified:${sessionId}`);
    if (!raw) throw new UnauthorizedException('Phien doi mat khau chua xac minh hoac da het han');
    const session = JSON.parse(raw) as { email: string; deviceId: string };
    if (session.deviceId !== deviceId) throw new UnauthorizedException('Thiet bi doi mat khau khong hop le');
    return session.email;
  }

  private hash(value: string): string { return createHmac('sha256', this.secret).update(value).digest('hex'); }
}
