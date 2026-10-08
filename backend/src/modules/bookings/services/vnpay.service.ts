import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';

@Injectable()
export class VnpayService {
  constructor(private readonly config: ConfigService) {}

  createPaymentUrl(input: {
    txnRef: string;
    amountVnd: number;
    orderInfo: string;
    ipAddress: string;
    expiresAt: Date;
  }) {
    const tmnCode = this.config.get<string>('VNPAY_TMN_CODE');
    const secret = this.config.get<string>('VNPAY_HASH_SECRET');
    const baseUrl = this.config.get<string>('VNPAY_URL', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html');
    const returnUrl = this.config.get<string>('VNPAY_RETURN_URL');
    if (!tmnCode || !secret || !returnUrl) throw new BadRequestException('VNPAY chua duoc cau hinh');
    const now = new Date();
    const date = this.formatDate(now);
    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Amount: String(Math.round(input.amountVnd * 100)),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: input.txnRef,
      vnp_OrderInfo: input.orderInfo,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: input.ipAddress || '127.0.0.1',
      vnp_CreateDate: date,
      vnp_ExpireDate: this.formatDate(input.expiresAt),
    };
    const query = this.query(params);
    const signature = createHmac('sha512', secret).update(query, 'utf8').digest('hex');
    return `${baseUrl}?${query}&vnp_SecureHash=${signature}`;
  }

  verify(params: Record<string, string | undefined>) {
    const secret = this.config.get<string>('VNPAY_HASH_SECRET');
    if (!secret) return false;
    const received = params.vnp_SecureHash;
    if (!received) return false;
    const copy = Object.fromEntries(
      Object.entries(params).filter(
        ([key, value]) => key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType' && value !== undefined,
      ),
    ) as Record<string, string>;
    return createHmac('sha512', secret).update(this.query(copy), 'utf8').digest('hex') === received;
  }

  private query(params: Record<string, string>) {
    return Object.keys(params)
      .sort()
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key]).replace(/%20/g, '+')}`)
      .join('&');
  }
  private formatDate(date: Date) {
    // VNPAY dates are GMT+7, independent of the server's host timezone.
    const local = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${local.getUTCFullYear()}${pad(local.getUTCMonth() + 1)}${pad(local.getUTCDate())}${pad(local.getUTCHours())}${pad(local.getUTCMinutes())}${pad(local.getUTCSeconds())}`;
  }
}
