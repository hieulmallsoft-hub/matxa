import { creditBookingPromotion } from './booking-promotion-credit';

// "Đơn mới nhấn nhận là cộng tiền luôn vào ví": the voucher credit now lands only when the booking completes.
describe('creditBookingPromotion (on completion)', () => {
  const setup = (booking: unknown, credited: unknown = null) => ({
    booking: { findUnique: jest.fn().mockResolvedValue(booking) },
    walletLedgerEntry: { findUnique: jest.fn().mockResolvedValue(credited), create: jest.fn() },
    wallet: { upsert: jest.fn().mockResolvedValue({ id: 'w1' }), update: jest.fn().mockResolvedValue({ balanceVnd: 547_000 }) },
  });

  it('credits the technician the discount the customer did not pay', async () => {
    const tx: any = setup({ discountAmount: 500_000, technician: { userId: 'tech' } });
    await expect(creditBookingPromotion(tx, 'b1')).resolves.toBe(500_000);
    expect(tx.wallet.update).toHaveBeenCalledWith(expect.objectContaining({ data: { balanceVnd: { increment: 500_000 } } }));
    expect(tx.walletLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'PROMOTION_CREDIT', amountVnd: 500_000, balanceBeforeVnd: 47_000, referenceType: 'BOOKING_PROMOTION_CREDIT', referenceId: 'b1' }),
    });
  });

  it('credits once, and nothing for a booking without a voucher', async () => {
    const twice: any = setup({ discountAmount: 500_000, technician: { userId: 'tech' } }, { id: 'credit' });
    await expect(creditBookingPromotion(twice, 'b1')).resolves.toBe(0);
    const none: any = setup({ discountAmount: 0, technician: { userId: 'tech' } });
    await expect(creditBookingPromotion(none, 'b1')).resolves.toBe(0);
    expect(twice.wallet.update).not.toHaveBeenCalled();
    expect(none.wallet.update).not.toHaveBeenCalled();
  });
});
