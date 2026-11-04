import { BookingsService } from './bookings.service';

// Once one technician gets an open booking, every other technician it reached must learn it is gone.
describe('open booking taken by one technician', () => {
  const config = { get: (_key: string, fallback: unknown) => fallback } as any;

  it('tells every other technician the booking reached, except the winner and those who said no', async () => {
    const prisma: any = {
      bookingTechnicianApplication: {
        findMany: jest.fn().mockResolvedValue([
          { status: 'DECLINED', technicianProfile: { userId: 'declined-user' } },
          { status: 'WITHDRAWN', technicianProfile: { userId: 'withdrawn-user' } },
        ]),
      },
      notification: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'winner-user' }, { userId: 'duc-user' }, { userId: 'silent-user' }, { userId: 'declined-user' },
          { userId: 'withdrawn-user' }, { userId: 'applied-user' },
        ]),
      },
    };
    const service: any = new BookingsService(prisma, config, {} as any, {} as any);
    const notify = jest.spyOn(service, 'notifyStatus').mockResolvedValue(undefined);

    await service.afterOpenBookingAssigned('booking-1', {
      booking: { technicianId: 'winner-profile' }, winnerUserId: 'winner-user', loserUserIds: ['applied-user'],
    });

    const recipients = notify.mock.calls.filter((call) => call[2] === 'TECHNICIAN_NOT_SELECTED').map((call) => call[0]).sort();
    expect(recipients).toEqual(['applied-user', 'duc-user', 'silent-user']);
    expect(notify).toHaveBeenCalledWith('silent-user', 'booking-1', 'TECHNICIAN_NOT_SELECTED', 'Đơn đã có KTV nhận', 'Đơn này đã có KTV khác nhận.');
  });

  it('still tells the applicants when the announcement lookup fails', async () => {
    const prisma: any = {
      bookingTechnicianApplication: { findMany: jest.fn().mockRejectedValue(new Error('db down')) },
      notification: { findMany: jest.fn() },
    };
    const service: any = new BookingsService(prisma, config, {} as any, {} as any);
    const notify = jest.spyOn(service, 'notifyStatus').mockResolvedValue(undefined);
    await service.afterOpenBookingAssigned('booking-1', {
      booking: { technicianId: 'winner-profile' }, winnerUserId: 'winner-user', loserUserIds: ['applied-user'],
    });
    expect(notify).toHaveBeenCalledWith('applied-user', 'booking-1', 'TECHNICIAN_NOT_SELECTED', expect.any(String), expect.any(String));
  });

  it('marks the job as taken for a technician who never applied', () => {
    const service: any = new BookingsService({} as any, config, {} as any, {} as any);
    const taken = {
      id: 'booking-1', assignmentMode: 'OPEN_MARKETPLACE', status: 'CONFIRMED', technicianId: 'winner-profile',
      requestedTechnicianId: 'duc-profile', items: [], subtotal: 0, serviceFee: 0, totalAmount: 0,
      scheduledStart: new Date(), scheduledEnd: new Date(), addressSnapshot: { address: '52 Ngõ 15, Bạch Mai, Hà Nội' },
    };
    expect(service.openBookingResponse(taken, null, false, true, 'duc-profile')).toMatchObject({
      customerSelectedAnotherTechnician: true, canApply: false, address: null,
    });
    expect(service.openBookingResponse(taken, 'SELECTED', true, true, 'winner-profile')).toMatchObject({
      customerSelectedAnotherTechnician: false,
    });
  });

  it('lets a technician who only got the announcement open the taken job', async () => {
    const taken = {
      id: 'booking-1', customerId: 'customer-1', assignmentMode: 'OPEN_MARKETPLACE', status: 'CONFIRMED',
      technicianId: 'winner-profile', technician: { userId: 'winner-user' }, requestedTechnicianId: 'duc-profile',
      items: [], applications: [], subtotal: 0, serviceFee: 0, totalAmount: 0, mode: 'HOME',
      scheduledStart: new Date(), scheduledEnd: new Date(),
    };
    const prisma: any = {
      booking: { findUnique: jest.fn().mockResolvedValue(taken) },
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'TECHNICIAN' }) },
      notification: { findFirst: jest.fn().mockResolvedValue({ id: 'announcement' }) },
      technicianProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'silent-profile' }),
        findFirst: jest.fn().mockResolvedValue({ id: 'silent-profile' }),
      },
      bookingTechnicianApplication: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new BookingsService(prisma, config, {} as any, {} as any);
    await expect(service.technicianJobDetail('silent-user', 'booking-1')).resolves.toMatchObject({
      bookingStatus: 'CONFIRMED', customerSelectedAnotherTechnician: true, address: null,
    });
  });
});
