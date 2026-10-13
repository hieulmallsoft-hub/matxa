import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

type PayosData = Record<string, string | number | boolean | null | undefined>;

@Injectable()
export class PayosService {
  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(
      this.config.get<string>('PAYOS_CLIENT_ID') &&
      this.config.get<string>('PAYOS_API_KEY') &&
      this.config.get<string>('PAYOS_CHECKSUM_KEY'),
    );
  }

  async createPaymentLink(input: { orderCode: number; amount: number; description: string; reference: string }) {
    const clientId = this.config.get<string>('PAYOS_CLIENT_ID');
    const apiKey = this.config.get<string>('PAYOS_API_KEY');
    const checksumKey = this.config.get<string>('PAYOS_CHECKSUM_KEY');
    const returnUrl = this.config.get<string>('PAYOS_RETURN_URL');
    const cancelUrl = this.config.get<string>('PAYOS_CANCEL_URL');
    if (!clientId || !apiKey || !checksumKey || !returnUrl || !cancelUrl)
      throw new BadRequestException('PayOS chua duoc cau hinh');

    const body = {
      orderCode: input.orderCode,
      amount: Math.round(input.amount),
      description: input.description.slice(0, 25),
      cancelUrl,
      returnUrl,
      signature: this.sign(
        {
          amount: Math.round(input.amount),
          cancelUrl,
          description: input.description.slice(0, 25),
          orderCode: input.orderCode,
          returnUrl,
        },
        checksumKey,
      ),
    };
    const response = await fetch(
      this.config.get<string>('PAYOS_API_URL', 'https://api-merchant.payos.vn/v2/payment-requests'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-client-id': clientId, 'x-api-key': apiKey },
        body: JSON.stringify(body),
      },
    );
    const payload = (await response.json()) as {
      code?: string;
      desc?: string;
      data?: { checkoutUrl?: string; paymentLinkId?: string };
    };
    if (!response.ok || payload.code !== '00' || !payload.data?.checkoutUrl)
      throw new BadRequestException(payload.desc || 'Khong tao duoc lien ket PayOS');
    return payload.data;
  }

  verifyWebhook(payload: { signature?: string; data?: PayosData }) {
    const checksumKey = this.config.get<string>('PAYOS_CHECKSUM_KEY');
    if (!checksumKey || !payload.signature || !payload.data)
      throw new UnauthorizedException('Webhook PayOS khong hop le');
    const expected = this.sign(payload.data, checksumKey);
    const actual = Buffer.from(payload.signature, 'utf8');
    const wanted = Buffer.from(expected, 'utf8');
    if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted))
      throw new UnauthorizedException('Sai chu ky webhook PayOS');
    return payload.data;
  }

  private sign(data: PayosData, key: string) {
    const canonical = Object.keys(data)
      .filter((name) => data[name] !== undefined && data[name] !== null)
      .sort()
      .map((name) => `${name}=${data[name]}`)
      .join('&');
    return createHmac('sha256', key).update(canonical, 'utf8').digest('hex');
  }
}
