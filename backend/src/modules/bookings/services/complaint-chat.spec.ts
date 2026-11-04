import { NotFoundException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { COMPLAINT_CREATED } from './complaint-conversation';

// "Hỗ trợ đơn hàng": each complaint gets its own customer <-> admin chat with the booking and
// technician shown on top, like Shopee's order support.
describe('complaint support chat', () => {
  const booking = {
    id: 'ecee5154-3327-4f90-baf8-867074880838', status: 'CONFIRMED', mode: 'HOME',
    scheduledStart: new Date('2026-11-04T09:00:00Z'), scheduledEnd: new Date('2026-11-04T10:30:00Z'),
    totalAmount: 700000, addressSnapshot: { address: '35 Tràng Tiền, Hoàn Kiếm, Hà Nội' }, payment: { method: 'CASH' },
    items: [{ serviceName: 'Massage Dầu', durationMinutes: 90, unitPrice: 600000 }],
    technician: { averageRating: 4.5, reviewCount: 2, user: { displayName: 'Duc Nguyen', avatarUrl: null } },
  };
  const complaint = {
    id: 'complaint-1', bookingId: booking.id, customerId: 'customer-1', reasonCode: 'TECHNICIAN_NO_CONTACT',
    detail: 'KTV khong den', contactEmail: 'a@b.com', status: 'SUBMITTED', createdAt: new Date(), evidence: [{ id: 'e1' }],
    booking,
  };

  const subject = (existingConversation: { id: string } | null = null) => {
    const prisma: any = {
      booking: { findFirst: jest.fn().mockResolvedValue({ id: booking.id, status: 'CONFIRMED', complaint: null }) },
      complaint: {
        create: jest.fn(async ({ data }: any) => ({ id: 'complaint-1', status: 'SUBMITTED', ...data })),
        findFirst: jest.fn().mockResolvedValue(complaint),
        findUnique: jest.fn().mockResolvedValue(complaint),
        update: jest.fn(async ({ data }: any) => ({ ...complaint, ...data })),
      },
      conversation: {
        findUnique: jest.fn().mockResolvedValue(existingConversation),
        create: jest.fn().mockResolvedValue({ id: 'conversation-1' }),
        update: jest.fn(),
      },
      message: { create: jest.fn() },
    };
    prisma.$transaction = jest.fn((callback: any) => callback(prisma));
    const notifications = { create: jest.fn(), sendPush: jest.fn().mockResolvedValue(undefined), notifyAdmins: jest.fn() };
    const service = new BookingsService(prisma, { get: (_k: string, f: unknown) => f } as any, notifications as any, {} as any);
    return { service, prisma, notifications };
  };

  it('opens the complaint chat when the customer files a complaint', async () => {
    const { service, prisma } = subject();
    const result = await service.createComplaint('customer-1', booking.id, {
      reasonCode: 'TECHNICIAN_NO_CONTACT', detail: 'KTV khong den', contactEmail: 'a@b.com',
    } as any);
    expect(result).toMatchObject({ id: 'complaint-1', conversationId: 'conversation-1' });
    expect(prisma.conversation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'COMPLAINT', complaintId: 'complaint-1', customerId: 'customer-1',
        members: { create: { userId: 'customer-1' } },
        messages: { create: expect.objectContaining({ type: 'SYSTEM', text: COMPLAINT_CREATED, bookingId: booking.id }) },
      }),
      select: { id: true },
    });
  });

  it('gives the chat header the booking, the booked technician and the complaint', async () => {
    const { service } = subject({ id: 'conversation-1' });
    await expect(service.customerComplaint('customer-1', booking.id)).resolves.toEqual({
      id: 'complaint-1', status: 'SUBMITTED', statusLabel: 'Đã tiếp nhận', reasonCode: 'TECHNICIAN_NO_CONTACT',
      reasonLabel: 'KTV không liên hệ, không đến', detail: 'KTV khong den', contactEmail: 'a@b.com',
      createdAt: complaint.createdAt, evidenceCount: 1, conversationId: 'conversation-1',
      booking: {
        id: booking.id, code: 'ECEE5154', status: 'CONFIRMED', mode: 'HOME',
        scheduledStart: booking.scheduledStart, scheduledEnd: booking.scheduledEnd,
        addressText: '35 Tràng Tiền, Hoàn Kiếm, Hà Nội', paymentMethod: 'CASH', totalAmount: 700000,
        items: [{ name: 'Massage Dầu', durationMinutes: 90, price: 600000 }],
      },
      technician: { displayName: 'Duc Nguyen', avatarUrl: null, averageRating: 4.5, reviewCount: 2 },
    });
  });

  it('answers 404 when the booking has no complaint of this customer', async () => {
    const { service, prisma } = subject();
    prisma.complaint.findFirst.mockResolvedValue(null);
    await expect(service.customerComplaint('customer-1', booking.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('posts the new status in the chat and notifies the customer', async () => {
    const { service, prisma, notifications } = subject({ id: 'conversation-1' });
    await service.updateComplaintStatus('admin-1', 'complaint-1', 'RESOLVED');
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 'conversation-1', senderId: 'admin-1', type: 'SYSTEM', text: 'COMPLAINT_STATUS:RESOLVED', bookingId: booking.id,
      }),
    });
    expect(notifications.create).toHaveBeenCalledWith(
      'customer-1', 'COMPLAINT_STATUS_CHANGED', 'Cập nhật khiếu nại',
      'Khiếu nại đơn #ECEE5154: Đã giải quyết', 'matxa://chat/conversation-1',
    );
  });
});
