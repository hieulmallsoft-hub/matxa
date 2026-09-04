import { Injectable } from '@nestjs/common';
import { SmsProvider } from './sms-provider.interface';

@Injectable()
export class DevelopmentSmsProvider implements SmsProvider {
  async sendOtp(_phoneNumber: string, _code: string): Promise<void> {
    // Development code is returned by the API; never write OTP to application logs.
    await Promise.resolve();
  }
}
