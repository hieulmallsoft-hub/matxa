import { Prisma } from '../../../generated/prisma/client';

/**
 * Credits back the commission taken from the technician's wallet when they took the booking.
 * Runs inside the cancelling transaction; the ledger's unique reference makes it a one-time refund.
 * Returns the refunded amount (0 when nothing was charged or it was already refunded).
 */
export async function refundBookingCommission(tx: Prisma.TransactionClient, bookingId: string) {
  const refunded = await refundCommission(tx, bookingId);
  await reversePromotionCredit(tx, bookingId);
  return refunded;
}

async function refundCommission(tx: Prisma.TransactionClient, bookingId: string) {
  const debit = await tx.walletLedgerEntry.findUnique({
    where: { referenceType_referenceId: { referenceType: 'BOOKING_COMMISSION', referenceId: bookingId } },
  });
  if (!debit || debit.amountVnd >= 0) return 0;
  const refunded = await tx.walletLedgerEntry.findUnique({
    where: { referenceType_referenceId: { referenceType: 'BOOKING_COMMISSION_REFUND', referenceId: bookingId } },
  });
  if (refunded) return 0;
  const amount = -debit.amountVnd;
  const wallet = await tx.wallet.update({
    where: { id: debit.walletId },
    data: { balanceVnd: { increment: amount } },
    select: { balanceVnd: true },
  });
  await tx.walletLedgerEntry.create({
    data: {
      walletId: debit.walletId,
      type: 'COMMISSION_REFUND',
      amountVnd: amount,
      balanceBeforeVnd: wallet.balanceVnd - amount,
      balanceAfterVnd: wallet.balanceVnd,
      referenceType: 'BOOKING_COMMISSION_REFUND',
      referenceId: bookingId,
    },
  });
  return amount;
}

/**
 * Takes back the voucher discount the platform credited when the booking was taken; the customer pays nothing for a
 * cancelled booking. The balance may go below zero if the technician already spent it, and the next top-up covers it.
 */
async function reversePromotionCredit(tx: Prisma.TransactionClient, bookingId: string) {
  const credit = await tx.walletLedgerEntry.findUnique({
    where: { referenceType_referenceId: { referenceType: 'BOOKING_PROMOTION_CREDIT', referenceId: bookingId } },
  });
  if (!credit || credit.amountVnd <= 0) return;
  const reversed = await tx.walletLedgerEntry.findUnique({
    where: { referenceType_referenceId: { referenceType: 'BOOKING_PROMOTION_CREDIT_REVERSAL', referenceId: bookingId } },
  });
  if (reversed) return;
  const wallet = await tx.wallet.update({
    where: { id: credit.walletId },
    data: { balanceVnd: { decrement: credit.amountVnd } },
    select: { balanceVnd: true },
  });
  await tx.walletLedgerEntry.create({
    data: {
      walletId: credit.walletId,
      type: 'PROMOTION_CREDIT_REVERSAL',
      amountVnd: -credit.amountVnd,
      balanceBeforeVnd: wallet.balanceVnd + credit.amountVnd,
      balanceAfterVnd: wallet.balanceVnd,
      referenceType: 'BOOKING_PROMOTION_CREDIT_REVERSAL',
      referenceId: bookingId,
    },
  });
}
