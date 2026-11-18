import { BookingsService } from './bookings.service';

describe('booking payment details by viewer', () => {
  const service: any = new BookingsService({} as any, { get: (_k: string, f: unknown) => f } as any, {} as any, {} as any);
  const payment = {
    id: 'pay-1', method: 'ONLINE', status: 'PAID', amount: '2000', provider: 'PAYOS', paidAt: new Date(),
    providerRef: '1794891512538157', providerTransactionNo: '2543', responseCode: '00',
    payerBankBin: null, payerBankName: 'TMCP Tien Phong', payerAccountNumber: '04031690001', payerAccountName: 'NGUYEN VAN A',
  };
  const booking = (extra: object = {}) => ({
    id: 'booking-1', customerId: 'customer-1', technicianId: 'profile-1', mode: 'ONLINE', status: 'COMPLETED',
    assignmentMode: 'OPEN_MARKETPLACE', items: [], applications: [], complaints: [], payment,
    technician: { userId: 'tech-1', user: {} }, subtotal: 0, serviceFee: 0, discountAmount: 0, totalAmount: 2000, ...extra,
  });

  it('never gives a technician the payer bank account or the gateway references', () => {
    const view = service.historyResponse(booking(), 'tech-1');
    expect(view.payment).toMatchObject({ method: 'ONLINE', status: 'PAID', amount: '2000' });
    for (const field of ['payerBankName', 'payerAccountNumber', 'payerAccountName', 'payerBankBin', 'providerRef', 'providerTransactionNo', 'responseCode'])
      expect(view.payment).not.toHaveProperty(field);
  });

  it('leaves the customer their own payment', () => {
    expect(service.historyResponse(booking(), 'customer-1').payment).toMatchObject({ payerAccountNumber: '04031690001' });
  });

  it('gives the customer the refund queued for the admin, and nobody else', () => {
    const refund = { bookingId: 'booking-1', status: 'PENDING', paidAmount: 2000, feeAmount: 300, amount: 1700, createdAt: new Date(), doneAt: null };
    const cancelled = booking({ status: 'CANCELLED', refund });
    expect(service.historyResponse(cancelled, 'customer-1').refund).toEqual({
      status: 'PENDING', paidAmount: 2000, feeAmount: 300, amount: 1700, createdAt: refund.createdAt, doneAt: null,
    });
    expect(service.historyResponse(cancelled, 'tech-1').refund).toBeNull();
    expect(service.historyResponse(booking(), 'customer-1').refund).toBeNull();
  });

  it('looks refunds up only for the customer’s cancelled paid online bookings', async () => {
    const findMany = jest.fn().mockResolvedValue([{ bookingId: 'booking-1', status: 'DONE', amount: 1700 }]);
    const withDb: any = new BookingsService({ bookingRefund: { findMany } } as any, { get: (_k: string, f: unknown) => f } as any, {} as any, {} as any);
    const [paidCancelled, completed] = await withDb.withRefunds([booking({ status: 'CANCELLED' }), booking({ id: 'booking-2' })], 'customer-1');
    expect(findMany).toHaveBeenCalledWith({ where: { bookingId: { in: ['booking-1'] } } });
    expect(paidCancelled.refund).toMatchObject({ amount: 1700 });
    expect(completed.refund ?? null).toBeNull();
    findMany.mockClear();
    await withDb.withRefunds([booking({ status: 'CANCELLED' })], 'tech-1');
    expect(findMany).not.toHaveBeenCalled();
  });
});
