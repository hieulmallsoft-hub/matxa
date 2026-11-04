import { ForbiddenException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

// A technician who was requested by the customer, or who applied/declined, keeps seeing the
// marketplace booking after it leaves OPEN (cancelled, confirmed for someone else, ...).
describe('marketplace jobs a technician was involved in', () => {
  const cancelled = (applications: unknown[] = []) => ({
    id: 'booking-1',
    customerId: 'customer-1',
    assignmentMode: 'OPEN_MARKETPLACE',
    status: 'CANCELLED',
    technicianId: null,
    technician: null,
    requestedTechnicianId: 'duc-profile',
    scheduledStart: new Date(Date.now() + 3_600_000),
    scheduledEnd: new Date(Date.now() + 7_200_000),
    applicationDeadlineAt: null,
    items: [],
    applications,
    subtotal: 100000,
    serviceFee: 0,
    totalAmount: 100000,
  });
  const declinedByFftools = {
    technicianProfileId: 'fftools-profile',
    status: 'DECLINED',
    technicianProfile: { user: { id: 'fftools-user' } },
  };

  const subject = (booking: any, profiles: Record<string, string>) => {
    const prisma: any = {
      booking: {
        findUnique: jest.fn().mockResolvedValue(booking),
        findMany: jest.fn().mockResolvedValue([{ ...booking, applications: [] }]),
        count: jest.fn().mockResolvedValue(1),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'TECHNICIAN' }) },
      notification: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      technicianProfile: {
        findUnique: jest.fn(async ({ where }: any) => (profiles[where.userId] ? { id: profiles[where.userId] } : null)),
        findFirst: jest.fn(async ({ where }: any) => (profiles[where.userId] ? { id: profiles[where.userId] } : null)),
      },
      bookingTechnicianApplication: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new BookingsService(prisma, { get: (_key: string, fallback: unknown) => fallback } as any, {} as any, {} as any);
    return { service, prisma };
  };

  it('lists marketplace bookings that requested this technician, whatever their status', async () => {
    const { service, prisma } = subject(cancelled(), { 'duc-user': 'duc-profile' });
    const list = await service.listTechnicianJobs('duc-user', { page: 1, limit: 20 } as any);
    const openWhere = prisma.booking.findMany.mock.calls[0][0].where.OR[1];
    expect(openWhere.OR).toContainEqual({ requestedTechnicianId: 'duc-profile' });
    expect(list.items[0]).toMatchObject({ bookingStatus: 'CANCELLED' });
  });

  it('lets the requested technician open a booking the customer cancelled before they applied', async () => {
    const { service } = subject(cancelled(), { 'duc-user': 'duc-profile' });
    await expect(service.detail('duc-user', 'booking-1', true, true)).resolves.toMatchObject({ status: 'CANCELLED' });
    await expect(service.technicianJobDetail('duc-user', 'booking-1')).resolves.toMatchObject({ bookingStatus: 'CANCELLED' });
  });

  it('lets a technician open a booking they declined after it left OPEN', async () => {
    const { service, prisma } = subject(cancelled([declinedByFftools]), { 'fftools-user': 'fftools-profile' });
    prisma.bookingTechnicianApplication.findUnique.mockResolvedValue(declinedByFftools);
    await expect(service.detail('fftools-user', 'booking-1', true, true)).resolves.toMatchObject({ id: 'booking-1' });
    await expect(service.technicianJobDetail('fftools-user', 'booking-1')).resolves.toMatchObject({
      applicationStatus: 'DECLINED',
    });
  });

  it('still refuses a technician who was neither requested nor applied', async () => {
    const { service } = subject(cancelled([declinedByFftools]), { 'other-user': 'other-profile' });
    await expect(service.detail('other-user', 'booking-1', true, true)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
