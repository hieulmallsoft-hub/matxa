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

  async createPaymentLink(input: { orderCode: number; amount: number; description: string; reference: string; expiredAt?: number }) {
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
      // Unix seconds: the link (and its QR) stops working with the booking's payment window.
      ...(input.expiredAt ? { expiredAt: input.expiredAt } : {}),
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
      data?: {
        checkoutUrl?: string;
        paymentLinkId?: string;
        qrCode?: string;
        accountNumber?: string;
        accountName?: string;
      };
    };
    if (!response.ok || payload.code !== '00' || !payload.data?.checkoutUrl)
      throw new BadRequestException(payload.desc || 'Khong tao duoc lien ket PayOS');
    return payload.data;
  }

  /**
   * Asks PayOS what happened to a payment link (backup for a webhook that never arrived). The call is authenticated
   * with our own API key over HTTPS, so the answer is trusted as is.
   */
  async getPaymentInfo(orderCode: string | number) {
    const payload = (await this.call('GET', `/${encodeURIComponent(String(orderCode))}`)) as {
      code?: string;
      desc?: string;
      data?: {
        status?: string;
        amount?: number;
        amountPaid?: number;
        transactions?: Array<Record<string, string | number | null | undefined>>;
      };
    };
    return { code: payload?.code ?? null, desc: payload?.desc ?? null, data: payload?.code === '00' ? payload.data ?? null : null };
  }

  /** Closes a link that is being replaced, so the customer cannot pay an old one nobody is waiting on. */
  async cancelPaymentLink(orderCode: string | number, reason = 'Tao lien ket moi') {
    await this.call('POST', `/${encodeURIComponent(String(orderCode))}/cancel`, { cancellationReason: reason });
  }

  private async call(method: 'GET' | 'POST', path: string, body?: object) {
    const clientId = this.config.get<string>('PAYOS_CLIENT_ID');
    const apiKey = this.config.get<string>('PAYOS_API_KEY');
    if (!clientId || !apiKey) throw new BadRequestException('PayOS chua duoc cau hinh');
    const base = this.config.get<string>('PAYOS_API_URL', 'https://api-merchant.payos.vn/v2/payment-requests');
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-client-id': clientId, 'x-api-key': apiKey },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return response.json() as Promise<unknown>;
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

  mobileRedirect(kind: 'return' | 'cancel', query: Record<string, string | undefined>) {
    const target = this.config.get<string>(kind === 'return' ? 'PAYOS_APP_RETURN_URL' : 'PAYOS_APP_CANCEL_URL');
    if (!target) throw new BadRequestException('PayOS mobile redirect chua duoc cau hinh');
    let url: URL;
    try {
      url = new URL(target);
    } catch {
      throw new BadRequestException('PayOS mobile redirect URL khong hop le');
    }
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
    return url.toString();
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
