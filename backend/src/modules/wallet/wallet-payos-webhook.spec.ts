import { WalletService } from './wallet.service';

// PayOS sends every event of the channel to the one webhook URL saved in its dashboard: wallet top-ups and booking
// payments arrive at the same place and each must reach its own handler.
describe('the single PayOS webhook', () => {
  const setup = (topUp: object | null) => {
    const prisma: any = { topUpTransaction: { findFirst: jest.fn().mockResolvedValue(topUp) } };
    const payos: any = { verifyWebhook: (body: any) => body.data };
    return new WalletService(prisma, {} as any, payos);
  };
  const event = { code: '00', success: true, data: { orderCode: 123, amount: 2000 } };

  it('hands a booking payment (not a top-up) to the booking handler', async () => {
    const bookings = jest.fn().mockResolvedValue({ code: '00', handled: true });
    await expect(setup(null).processPayosWebhook(event, bookings)).resolves.toEqual({ code: '00', handled: true });
    expect(bookings).toHaveBeenCalledWith(event);
  });

  it('keeps a top-up for the wallet', async () => {
    const service = setup({ id: 't1', amountVnd: 5000, status: 'PENDING_PAYMENT' });
    const bookings = jest.fn();
    jest.spyOn(service as any, 'simulateInternal').mockResolvedValue({ id: 't1', status: 'SUCCESS' });
    await expect(service.processPayosWebhook({ ...event, data: { orderCode: 123, amount: 5000 } }, bookings)).resolves.toMatchObject({ status: 'SUCCESS' });
    expect(bookings).not.toHaveBeenCalled();
  });
});
