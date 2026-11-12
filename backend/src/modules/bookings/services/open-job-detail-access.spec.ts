import { ForbiddenException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

// A technician who became eligible after an open job was announced (e.g. they cancelled their own job seconds later)
// sees it in their job list, so they must be able to open it too, without the announcement.
describe('technician opens an open job they were not announced', () => {
  const subject = (status: string) => {
    const prisma: any = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'job-1', status, assignmentMode: 'OPEN_MARKETPLACE', customerId: 'customer-1', requestedTechnicianId: 'other',
          technician: null, applications: [], items: [], complaints: [], addressSnapshot: null, address: null,
        }),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'TECHNICIAN' }) },
      notification: { findFirst: jest.fn().mockResolvedValue(null) },
      technicianProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'ff-profile' }) },
    };
    const service = new BookingsService(prisma, { get: (_k: string, f: unknown) => f } as any, {} as any, {} as any);
    return (service as any).detail('ff-user', 'job-1', true, true) as Promise<any>;
  };

  it('can open a job that is still open', async () => {
    await expect(subject('OPEN')).resolves.toMatchObject({ id: 'job-1', status: 'OPEN' });
  });

  it('still cannot open a past job they were never announced nor involved in', async () => {
    await expect(subject('EXPIRED')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(subject('CONFIRMED')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
