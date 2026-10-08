import { BookingsService } from './bookings.service';

describe('open marketplace selection', () => {
  it('selects one applicant, marks the remaining applicants NOT_SELECTED and assigns the booking', async () => {
    const winner = {
      id: 'application-winner',
      technicianProfileId: 'tech-profile-1',
      technicianProfile: { user: { id: 'tech-user-1' } },
    };
    const booking = {
      id: 'booking-1',
      customerId: 'customer-1',
      assignmentMode: 'OPEN_MARKETPLACE',
      status: 'OPEN',
      technicianId: null,
      mode: 'HOME',
      scheduledStart: new Date(Date.now() + 3_600_000),
      scheduledEnd: new Date(Date.now() + 7_200_000),
      items: [{ catalogService: { categoryId: 'category-1' }, durationMinutes: 60 }],
    };
    const tx: any = {
      booking: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(booking),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({
          ...booking,
          technicianId: 'tech-profile-1',
          status: 'CONFIRMED',
          payment: { method: 'CASH' },
        }),
      },
      bookingTechnicianApplication: {
        findFirst: jest.fn().mockResolvedValue(winner),
        update: jest.fn().mockResolvedValue(winner),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([{ technicianProfile: { userId: 'tech-user-2' } }]),
      },
      technicianProfile: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'tech-profile-1', city: 'HN', district: null, serviceModes: ['HOME'] }),
      },
      technicianService: { findFirst: jest.fn().mockResolvedValue({ id: 'service-1' }) },
      availabilitySlot: { findFirst: jest.fn().mockResolvedValue({ id: 'slot-1' }) },
    };
    const prisma: any = { $transaction: jest.fn(async (callback: any) => callback(tx)) };
    const notifications = { create: jest.fn().mockResolvedValue({}), sendPush: jest.fn().mockResolvedValue({}) };
    const service = new BookingsService(
      prisma,
      { get: jest.fn() } as any,
      notifications as any,
      { createPaymentUrl: jest.fn(), verify: jest.fn() } as any,
    );

    const response = await service.selectTechnician('customer-1', 'booking-1', 'application-winner');

    expect(tx.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'OPEN', technicianId: null }) }),
    );
    expect(tx.bookingTechnicianApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SELECTED' }) }),
    );
    expect(tx.bookingTechnicianApplication.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'NOT_SELECTED' } }),
    );
    expect(tx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { technicianId: 'tech-profile-1', status: 'CONFIRMED' } }),
    );
    expect(response).toMatchObject({
      bookingId: 'booking-1',
      bookingStatus: 'CONFIRMED',
      applicationStatus: 'SELECTED',
    });
  });
});
