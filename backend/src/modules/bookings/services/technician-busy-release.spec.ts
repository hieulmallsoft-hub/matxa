import { ConflictException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

// A technician takes one booking at a time. Once they get one, their other open requests must not
// keep customers waiting: requests addressed to them are declined for them, applications withdrawn.
describe('technician gets a booking while other open requests are pending', () => {
  const config = { get: (_key: string, fallback: unknown) => fallback } as any;

  const subject = () => {
    const prisma: any = {
      bookingTechnicianApplication: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'requested-elsewhere', customerId: 'customer-b' },
        ]),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ displayName: 'Duc Nguyen' }) },
    };
    const service: any = new BookingsService(prisma, config, {} as any, {} as any);
    const notify = jest.spyOn(service, 'notifyStatus').mockResolvedValue(undefined);
    return { service, prisma, notify };
  };

  it('withdraws their applications on other open bookings', async () => {
    const { service, prisma } = subject();
    await service.releaseOtherOpenRequests('duc-profile', 'duc-user', 'taken');
    expect(prisma.bookingTechnicianApplication.updateMany).toHaveBeenCalledWith({
      where: {
        technicianProfileId: 'duc-profile', status: 'APPLIED', bookingId: { not: 'taken' },
        booking: { assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN' },
      },
      data: { status: 'WITHDRAWN', withdrawnAt: expect.any(Date) },
    });
  });

  it('declines, on their behalf, open bookings that asked for them and tells those customers', async () => {
    const { service, prisma, notify } = subject();
    await service.releaseOtherOpenRequests('duc-profile', 'duc-user', 'taken');
    expect(prisma.booking.findMany).toHaveBeenCalledWith({
      where: {
        id: { not: 'taken' }, assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN',
        requestedTechnicianId: 'duc-profile', applications: { none: { technicianProfileId: 'duc-profile' } },
      },
      select: { id: true, customerId: true },
    });
    expect(prisma.bookingTechnicianApplication.createMany).toHaveBeenCalledWith({
      data: [{ bookingId: 'requested-elsewhere', technicianProfileId: 'duc-profile', status: 'DECLINED', declinedAt: expect.any(Date) }],
      skipDuplicates: true,
    });
    expect(notify).toHaveBeenCalledWith(
      'customer-b', 'requested-elsewhere', 'REQUESTED_TECHNICIAN_DECLINED', 'KTV đã từ chối',
      'Duc Nguyen đã nhận đơn khác nên không thể nhận đơn này. Đơn vẫn mở để KTV khác nhận.',
    );
  });

  it('runs after an open booking is assigned', async () => {
    const { service } = subject();
    jest.spyOn(service, 'notifyStatus').mockResolvedValue(undefined);
    service.prisma.bookingTechnicianApplication.findMany = jest.fn().mockResolvedValue([]);
    service.prisma.notification = { findMany: jest.fn().mockResolvedValue([]) };
    const release = jest.spyOn(service, 'releaseOtherOpenRequests').mockResolvedValue(undefined);
    await service.afterOpenBookingAssigned('taken', {
      booking: { technicianId: 'duc-profile' }, winnerUserId: 'duc-user', loserUserIds: [],
    });
    expect(release).toHaveBeenCalledWith('duc-profile', 'duc-user', 'taken');
  });

  it('shows a job the technician can no longer take as UNAVAILABLE instead of an error', async () => {
    const open = {
      id: 'other', customerId: 'customer-1', assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN', technicianId: null,
      requestedTechnicianId: null, items: [], applications: [], subtotal: 0, serviceFee: 0, totalAmount: 0, mode: 'HOME',
      scheduledStart: new Date(Date.now() + 3_600_000), scheduledEnd: new Date(Date.now() + 7_200_000),
      applicationDeadlineAt: new Date(Date.now() + 600_000),
    };
    const prisma: any = {
      technicianProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'duc-profile' }) },
      bookingTechnicianApplication: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service: any = new BookingsService(prisma, config, {} as any, {} as any);
    jest.spyOn(service, 'detail').mockResolvedValue(open);
    jest.spyOn(service, 'openJobForTechnician').mockRejectedValue(
      new ConflictException('KTV phai hoan thanh don hien tai truoc khi nhan don moi'),
    );
    await expect(service.technicianJobDetail('duc-user', 'other')).resolves.toMatchObject({
      displayStatus: 'UNAVAILABLE', canApply: false, canDecline: false,
      unavailableReason: 'KTV phai hoan thanh don hien tai truoc khi nhan don moi',
    });
  });
});
