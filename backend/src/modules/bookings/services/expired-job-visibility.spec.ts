import { BookingsService } from './bookings.service';

// An expired marketplace booking stays in the history of the technicians it reached,
// but must not be shown to every technician in the system, and never with the exact address.
describe('expired marketplace jobs', () => {
  const config = { get: (_key: string, fallback: unknown) => fallback } as any;

  it('lists only expired jobs this technician was notified about', async () => {
    const prisma: any = {
      technicianProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'tech-profile', latitude: null, longitude: null }) },
      notification: {
        findMany: jest.fn().mockResolvedValue([
          { actionUrl: 'matxa://bookings/announced-1' },
          { actionUrl: 'matxa://bookings/announced-2' },
        ]),
      },
      booking: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    const service = new BookingsService(prisma, config, {} as any, {} as any);
    await service.listTechnicianJobs('tech-user', { page: 1, limit: 20 } as any);

    expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'tech-user' }),
    }));
    const openWhere = prisma.booking.findMany.mock.calls[0][0].where.OR[1];
    expect(openWhere.OR).not.toContainEqual({ status: 'EXPIRED' });
    expect(openWhere.OR).toContainEqual({ status: 'EXPIRED', id: { in: ['announced-1', 'announced-2'] } });
  });

  it('does not hand out the exact address of an expired job', () => {
    const service: any = new BookingsService({} as any, config, {} as any, {} as any);
    const expired = {
      id: 'booking-1', assignmentMode: 'OPEN_MARKETPLACE', status: 'EXPIRED', mode: 'HOME', items: [],
      subtotal: 0, serviceFee: 0, totalAmount: 0, scheduledStart: new Date(), scheduledEnd: new Date(),
      addressSnapshot: { address: '52 Ngõ 15, Bạch Mai, Hà Nội', latitude: 21, longitude: 105.8 },
    };
    expect(service.openBookingResponse(expired, 'EXPIRED', false, true, 'tech-profile')).toMatchObject({ address: null });
  });
});
