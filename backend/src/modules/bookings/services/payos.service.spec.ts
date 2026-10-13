import { ConfigService } from '@nestjs/config';
import { PayosService } from './payos.service';

describe('PayosService', () => {
  const config = new ConfigService({
    PAYOS_CLIENT_ID: 'client',
    PAYOS_API_KEY: 'api-key',
    PAYOS_CHECKSUM_KEY: 'checksum-key-123456',
    PAYOS_RETURN_URL: 'https://example.com/return',
    PAYOS_CANCEL_URL: 'https://example.com/cancel',
  });

  it('creates a payment link with PayOS headers and checksum', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ code: '00', data: { checkoutUrl: 'https://payos.test/1', paymentLinkId: 'link-1' } }),
    } as Response);
    const result = await new PayosService(config).createPaymentLink({
      orderCode: 123,
      amount: 50000,
      description: 'MATXA booking',
      reference: 'payment-1',
    });
    expect(result.checkoutUrl).toContain('payos.test');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { 'x-client-id': 'client', 'x-api-key': 'api-key' } });
    fetchMock.mockRestore();
  });

  it('rejects a webhook with an invalid signature', () => {
    expect(() =>
      new PayosService(config).verifyWebhook({ signature: 'invalid', data: { amount: 50000, orderCode: 123 } }),
    ).toThrow();
  });

  it('builds a mobile redirect without trusting a caller supplied URL', () => {
    const url = new PayosService(new ConfigService({ PAYOS_APP_RETURN_URL: 'psyocore://payment/payos/success' })).mobileRedirect('return', {
      code: '00',
      orderCode: '123',
    });
    expect(url).toBe('psyocore://payment/payos/success?code=00&orderCode=123');
  });
});
