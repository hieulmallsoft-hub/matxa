import { Prisma } from '../../../generated/prisma/client';

/**
 * The platform pays for the customer's voucher: the customer hands the technician that much less cash, so the
 * technician's wallet gets the discount back — only once the booking is COMPLETED, never when it is merely taken
 * (a technician could otherwise take a voucher booking, pocket the credit and leave it). Runs in the completing
 * transaction; the ledger's unique reference makes it one-time. Returns the amount credited.
 */
export async function creditBookingPromotion(tx: Prisma.TransactionClient, bookingId: string) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: { discountAmount: true, technician: { select: { userId: true } } },
  });
  const discount = Math.round(Number(booking?.discountAmount ?? 0));
  const userId = booking?.technician?.userId;
  if (!userId || discount <= 0) return 0;
  const credited = await tx.walletLedgerEntry.findUnique({
    where: { referenceType_referenceId: { referenceType: 'BOOKING_PROMOTION_CREDIT', referenceId: bookingId } },
  });
  if (credited) return 0;
  const wallet = await tx.wallet.upsert({
    where: { userId_type: { userId, type: 'ADVERTISING_CREDIT' } },
    create: { userId, type: 'ADVERTISING_CREDIT' },
    update: {},
  });
  const updated = await tx.wallet.update({
    where: { id: wallet.id },
    data: { balanceVnd: { increment: discount } },
    select: { balanceVnd: true },
  });
  await tx.walletLedgerEntry.create({
    data: {
      walletId: wallet.id,
      type: 'PROMOTION_CREDIT',
      amountVnd: discount,
      balanceBeforeVnd: updated.balanceVnd - discount,
      balanceAfterVnd: updated.balanceVnd,
      referenceType: 'BOOKING_PROMOTION_CREDIT',
      referenceId: bookingId,
    },
  });
  return discount;
}
