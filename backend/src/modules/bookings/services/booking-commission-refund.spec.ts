import { refundBookingCommission } from './booking-commission-refund';

describe('refundBookingCommission', () => {
  const subject = (debit: unknown, refunded: unknown = null) => {
    const tx: any = {
      walletLedgerEntry: {
        findUnique: jest.fn().mockResolvedValueOnce(debit).mockResolvedValueOnce(refunded),
        create: jest.fn(),
      },
      wallet: { update: jest.fn().mockResolvedValue({ balanceVnd: 300000 }) },
    };
    return tx;
  };

  it('credits the wallet and records a COMMISSION_REFUND entry', async () => {
    const tx = subject({ walletId: 'wallet-1', amountVnd: -50000 });
    await expect(refundBookingCommission(tx, 'booking-1')).resolves.toBe(50000);
    expect(tx.walletLedgerEntry.create).toHaveBeenCalledWith({
      data: {
        walletId: 'wallet-1',
        type: 'COMMISSION_REFUND',
        amountVnd: 50000,
        balanceBeforeVnd: 250000,
        balanceAfterVnd: 300000,
        referenceType: 'BOOKING_COMMISSION_REFUND',
        referenceId: 'booking-1',
      },
    });
  });

  it('does nothing when no commission was charged', async () => {
    const tx = subject(null);
    await expect(refundBookingCommission(tx, 'booking-1')).resolves.toBe(0);
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it('refunds only once', async () => {
    const tx = subject({ walletId: 'wallet-1', amountVnd: -50000 }, { id: 'refund-1' });
    await expect(refundBookingCommission(tx, 'booking-1')).resolves.toBe(0);
    expect(tx.wallet.update).not.toHaveBeenCalled();
    expect(tx.walletLedgerEntry.create).not.toHaveBeenCalled();
  });
});
