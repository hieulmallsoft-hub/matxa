import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma.service';

/** System message that opens a complaint thread; the chat renders it as the complaint card. */
export const COMPLAINT_CREATED = 'COMPLAINT_CREATED';
/** System message posted when an admin moves the complaint, e.g. `COMPLAINT_STATUS:RESOLVED`. */
export const complaintStatusEvent = (status: string) => `COMPLAINT_STATUS:${status}`;

export const COMPLAINT_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Đã tiếp nhận',
  IN_REVIEW: 'Đang xử lý',
  RESOLVED: 'Đã giải quyết',
  REJECTED: 'Từ chối',
};

/**
 * Returns the customer <-> admin thread of a complaint, creating it on first use so
 * complaints filed before this feature also get one. The technician is never a member.
 */
export async function ensureComplaintConversation(
  db: Prisma.TransactionClient | PrismaService,
  complaint: { id: string; customerId: string; bookingId: string },
) {
  const existing = await db.conversation.findUnique({ where: { complaintId: complaint.id }, select: { id: true } });
  if (existing) return existing.id;
  try {
    const created = await db.conversation.create({
      data: {
        type: 'COMPLAINT',
        complaintId: complaint.id,
        customerId: complaint.customerId,
        participantKey: `complaint:${complaint.id}`,
        lastMessageAt: new Date(),
        members: { create: { userId: complaint.customerId } },
        messages: {
          create: { senderId: complaint.customerId, type: 'SYSTEM', text: COMPLAINT_CREATED, bookingId: complaint.bookingId },
        },
      },
      select: { id: true },
    });
    return created.id;
  } catch (error) {
    // Two first opens at once: complaintId is unique, so read the one that won.
    if ((error as { code?: string }).code !== 'P2002') throw error;
    return (await db.conversation.findUniqueOrThrow({ where: { complaintId: complaint.id }, select: { id: true } })).id;
  }
}
