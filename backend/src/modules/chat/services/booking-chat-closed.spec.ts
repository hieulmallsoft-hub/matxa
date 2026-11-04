import { ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';

// A booking chat is for the booking: once it is cancelled or expired the thread stays readable
// but nobody can write in it any more (seen live: a KTV kept messaging a customer through old,
// cancelled bookings while the customer was waiting for another KTV on a new one).
describe('chat of a cancelled booking', () => {
  const subject = (bookingStatus: string) => {
    const booking = {
      id: 'booking-1', customerId: 'customer-1', assignmentMode: 'OPEN_MARKETPLACE', status: bookingStatus,
      technicianId: 'ff-profile', technician: { id: 'ff-profile', userId: 'ff-user' },
      applications: [{ technicianProfileId: 'ff-profile' }],
    };
    const prisma: any = {
      conversationMember: { findUnique: jest.fn().mockResolvedValue({ conversationId: 'conversation-1', userId: 'ff-user' }) },
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'TECHNICIAN' }) },
      conversation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'conversation-1', bookingId: 'booking-1', type: 'BOOKING', supportCustomerId: null }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ bookingId: 'booking-1', type: 'BOOKING' }),
      },
      booking: { findUnique: jest.fn().mockResolvedValue(booking) },
      message: { create: jest.fn().mockResolvedValue({ id: 'message-1' }) },
    };
    prisma.$transaction = jest.fn((callback: any) => callback(prisma));
    const service = new ChatService(prisma, { create: jest.fn(), sendPush: jest.fn() } as any, {} as any);
    return { service, prisma };
  };

  it.each(['CANCELLED', 'EXPIRED'])('refuses new messages once the booking is %s', async (status) => {
    const { service, prisma } = subject(status);
    await expect(service.sendMessage('ff-user', 'conversation-1', { type: 'TEXT', text: 'Chao ban' } as any)).rejects.toThrow(
      new ForbiddenException('Don da ket thuc, cuoc tro chuyen chi con xem lai'),
    );
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it.each(['CANCELLED', 'EXPIRED'])('refuses image uploads once the booking is %s', async (status) => {
    const { service } = subject(status);
    await expect(service.ensureCanWrite('ff-user', 'conversation-1')).rejects.toThrow(ForbiddenException);
  });

  it.each(['CONFIRMED', 'COMPLETED'])('still allows writing while the booking is %s', async (status) => {
    const { service } = subject(status);
    await expect(service.ensureCanWrite('ff-user', 'conversation-1')).resolves.toBeDefined();
  });

  it('keeps the history of a cancelled booking readable', async () => {
    const { service } = subject('CANCELLED');
    await expect(service.ensureMember('ff-user', 'conversation-1')).resolves.toBeDefined();
  });
});
