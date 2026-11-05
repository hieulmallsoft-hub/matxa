import { ConflictException, NotFoundException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

// Technicians complain too (customer not there, rude, did not pay); each side once per booking, each sees only its own.
describe('technician complaints', () => {
  const dto = { reasonCode: 'CUSTOMER_NO_SHOW', detail: 'Khach khong mo cua', contactEmail: 'ktv@b.com' } as any;
  const subject = (complaints: Array<{ reporterRole: string }>, booking: object | null = { id: 'booking-1', status: 'CONFIRMED', customerId: 'customer-1' }) => {
    const prisma: any = {
      booking: { findFirst: jest.fn().mockResolvedValue(booking && { ...booking, complaints }) },
      complaint: { create: jest.fn(async ({ data }: any) => ({ id: 'complaint-2', status: 'SUBMITTED', ...data })) },
      conversation: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'conversation-2' }) },
    };
    const notifications = { notifyAdmins: jest.fn() };
    const service = new BookingsService(prisma, { get: (_k: string, f: unknown) => f } as any, notifications as any, {} as any);
    return { service, prisma, notifications };
  };

  it('lets the booked technician complain even when the customer already did', async () => {
    const { service, prisma, notifications } = subject([{ reporterRole: 'CUSTOMER' }]);
    await expect(service.createComplaint('tech-user-1', 'booking-1', dto)).resolves.toMatchObject({
      reporterRole: 'TECHNICIAN', conversationId: 'conversation-2',
    });
    expect(prisma.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'booking-1', OR: [{ customerId: 'tech-user-1' }, { technician: { userId: 'tech-user-1' } }] } }),
    );
    expect(prisma.complaint.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ customerId: 'tech-user-1', reporterRole: 'TECHNICIAN', reasonCode: 'CUSTOMER_NO_SHOW' }) }),
    );
    // The chat is between the technician and the admins.
    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ customerId: 'tech-user-1', members: { create: { userId: 'tech-user-1' } } }) }),
    );
    expect(notifications.notifyAdmins).toHaveBeenCalledWith('ADMIN_COMPLAINT_CREATED', 'KTV gửi khiếu nại', expect.any(String), 'admin://complaints');
  });

  it('refuses a second complaint from the same side', async () => {
    const { service, prisma } = subject([{ reporterRole: 'TECHNICIAN' }]);
    await expect(service.createComplaint('tech-user-1', 'booking-1', dto)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.complaint.create).not.toHaveBeenCalled();
  });

  it('refuses someone who is neither the customer nor the technician of the booking', async () => {
    const { service } = subject([], null);
    await expect(service.createComplaint('stranger', 'booking-1', dto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("shows each side only its own complaint in the booking history", () => {
    const { service } = subject([]);
    const booking = {
      id: 'booking-1', customerId: 'customer-1', status: 'COMPLETED', assignmentMode: 'DIRECT', items: [],
      subtotal: 0, serviceFee: 0, discountAmount: 0, totalAmount: 0,
      technician: { userId: 'tech-user-1', user: {} },
      complaints: [
        { id: 'c-customer', customerId: 'customer-1', reporterRole: 'CUSTOMER', status: 'SUBMITTED', reasonCode: 'OTHER' },
        { id: 'c-tech', customerId: 'tech-user-1', reporterRole: 'TECHNICIAN', status: 'IN_REVIEW', reasonCode: 'CUSTOMER_BEHAVIOR' },
      ],
    };
    const asCustomer = (service as any).historyResponse(booking, 'customer-1');
    const asTechnician = (service as any).historyResponse(booking, 'tech-user-1');
    expect(asCustomer).toMatchObject({ complaint: { id: 'c-customer' }, canComplain: false });
    expect(asTechnician).toMatchObject({ complaint: { id: 'c-tech' }, canComplain: false });
    expect(asCustomer).not.toHaveProperty('complaints');
    expect(asTechnician).not.toHaveProperty('complaints');
  });
});
