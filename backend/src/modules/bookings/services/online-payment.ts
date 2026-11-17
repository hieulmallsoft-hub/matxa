import { Prisma } from '../../../generated/prisma/client';

/**
 * Online (video/chat) bookings are paid online, after a technician takes them: the money goes to the platform, the
 * technician's share is recorded when the job is completed and paid out by the admin; a paid booking that is
 * cancelled is refunded by the admin. Other bookings keep the cash flow (the technician pays the commission upfront).
 */
export function isPrepaid(booking: { mode?: string | null; payment?: { method?: string | null } | null }) {
  return booking.mode === 'ONLINE' && booking.payment?.method === 'ONLINE';
}

/** Taken, prepaid and not paid yet: the customer must pay before `paymentDeadlineAt`. */
export function isAwaitingPayment(booking: {
  status?: string;
  mode?: string | null;
  paymentDeadlineAt?: Date | string | null;
  payment?: { method?: string | null; status?: string | null } | null;
}) {
  return booking.status === 'CONFIRMED' && isPrepaid(booking) && Boolean(booking.paymentDeadlineAt) && booking.payment?.status !== 'PAID';
}

/**
 * The technician's share of a completed, paid online booking: the service price minus the commission (the platform
 * bears any voucher). Recorded once; the admin pays it out later.
 */
export async function recordTechnicianEarning(
  tx: Pick<Prisma.TransactionClient, 'booking' | 'technicianEarning'>,
  bookingId: string,
  commissionFor: (gross: number, technicianUserId: string) => Promise<number>,
) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: {
      mode: true,
      grossServiceAmount: true,
      subtotal: true,
      platformFee: true,
      payment: { select: { method: true, status: true } },
      technician: { select: { userId: true } },
    },
  });
  if (!booking?.technician || !isPrepaid(booking) || booking.payment?.status !== 'PAID') return null;
  const gross = Math.round(Number(booking.grossServiceAmount ?? booking.subtotal));
  // The commission fixed when the technician took the job (shown to them since); bookings taken before that was
  // recorded fall back to today's rate.
  const fixed = Math.round(Number(booking.platformFee ?? 0));
  const commission = fixed > 0 ? fixed : await commissionFor(gross, booking.technician.userId);
  try {
    return await tx.technicianEarning.create({
      data: { technicianUserId: booking.technician.userId, bookingId, grossAmount: gross, commission, amount: gross - commission },
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return null; // already recorded
    throw error;
  }
}

/**
 * A paid online booking was cancelled: the money goes back to the customer, by the admin's hand. A customer who
 * cancels after a technician took it keeps `feePercent` as a cancellation fee; anyone else's cancel is refunded in full.
 */
export async function createRefund(
  tx: Pick<Prisma.TransactionClient, 'booking' | 'bookingRefund'>,
  bookingId: string,
  options: { reason: string; feePercent: number },
) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: { customerId: true, mode: true, payment: { select: { method: true, status: true, amount: true } } },
  });
  if (!booking || !isPrepaid(booking) || booking.payment?.status !== 'PAID') return null;
  const paid = Math.round(Number(booking.payment.amount));
  if (paid <= 0) return null; // a voucher paid it all: there is nothing to give back
  const fee = Math.round((paid * Math.min(Math.max(options.feePercent, 0), 100)) / 100);
  try {
    return await tx.bookingRefund.create({
      data: { bookingId, customerId: booking.customerId, paidAmount: paid, feeAmount: fee, amount: paid - fee, reason: options.reason },
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return null; // already queued
    throw error;
  }
}

/** VietQR image the admin scans with a banking app: account, amount and transfer note filled in. */
export function vietQrUrl(bankBin: string | null | undefined, accountNumber: string | null | undefined, amount: number, note: string, accountName?: string | null) {
  if (!bankBin || !accountNumber) return null;
  const query = new URLSearchParams({ amount: String(Math.round(amount)), addInfo: note, ...(accountName ? { accountName } : {}) });
  return `https://img.vietqr.io/image/${encodeURIComponent(bankBin)}-${encodeURIComponent(accountNumber)}-compact2.png?${query}`;
}
