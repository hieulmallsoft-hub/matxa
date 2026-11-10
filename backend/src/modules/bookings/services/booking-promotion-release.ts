import { Prisma } from '../../../generated/prisma/client';

/**
 * A booking that ends without being served (cancelled by anyone, or expired with no technician) gives the customer
 * their voucher use back. Runs inside the same transaction as the status change; deleting the usage row makes it
 * one-time, so a repeated call does nothing. Returns whether a use was given back.
 */
export async function releaseBookingPromotion(tx: Prisma.TransactionClient, bookingId: string) {
  const usage = await tx.promotionUsage.findUnique({ where: { bookingId }, select: { id: true, promotionId: true } });
  if (!usage) return false;
  await tx.promotionUsage.delete({ where: { id: usage.id } });
  await tx.promotion.updateMany({
    where: { id: usage.promotionId, usedCount: { gt: 0 } },
    data: { usedCount: { decrement: 1 } },
  });
  return true;
}
