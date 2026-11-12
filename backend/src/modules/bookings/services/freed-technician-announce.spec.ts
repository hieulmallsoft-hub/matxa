import { BookingsService } from './bookings.service';

// A technician busy when an open job was created was not told about it. When they become free again they are told
// about the open jobs they can take now — once, and only those they were not already told about.
describe('announce open jobs to a technician who just became free', () => {
  const job = (id: string, extra: any = {}) => ({ id, status: 'OPEN', assignmentMode: 'OPEN_MARKETPLACE', requestedTechnicianId: null, ...extra });
  const subject = (open: any[], told: string[], ineligible: string[] = []) => {
    const prisma: any = {
      technicianProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'ff-profile', userId: 'ff-user' }) },
      booking: { findMany: jest.fn().mockResolvedValue(open) },
      notification: { findMany: jest.fn().mockResolvedValue(told.map((id) => ({ actionUrl: `matxa://bookings/${id}` }))) },
    };
    const service = new BookingsService(prisma, { get: (_k: string, f: unknown) => f } as any, {} as any, {} as any);
    jest.spyOn(service as any, 'assertOpenEligibility').mockImplementation(async (_db: any, booking: any) => {
      if (ineligible.includes(booking.id)) throw new Error('KTV khong phu hop khu vuc cua don');
    });
    const notify = jest.spyOn(service as any, 'notifyStatus').mockResolvedValue(undefined);
    return { prisma, service, notify };
  };

  it('tells them about open jobs they can take and were not told about', async () => {
    const { service, notify, prisma } = subject(
      [job('told'), job('new'), job('far'), job('picked-them', { requestedTechnicianId: 'ff-profile' })],
      ['told'],
      ['far'],
    );
    await service.announceOpenJobsToFreedTechnician('ff-user');
    expect(notify.mock.calls.map((call) => [call[1], call[2]])).toEqual([
      ['new', 'OPEN_BOOKING_AVAILABLE'],
      ['picked-them', 'OPEN_BOOKING_REQUESTED'],
    ]);
    // Only jobs still open, within their deadline, and not applied to by them.
    expect(prisma.booking.findMany.mock.calls[0][0].where).toMatchObject({
      status: 'OPEN', assignmentMode: 'OPEN_MARKETPLACE', applications: { none: { technicianProfileId: 'ff-profile' } },
    });
  });

  it('does nothing for a customer account, and never throws', async () => {
    const { service, prisma, notify } = subject([job('new')], []);
    prisma.technicianProfile.findUnique.mockResolvedValue(null);
    await expect(service.announceOpenJobsToFreedTechnician('customer-user')).resolves.toBeUndefined();
    prisma.technicianProfile.findUnique.mockRejectedValue(new Error('db down'));
    await expect(service.announceOpenJobsToFreedTechnician('ff-user')).resolves.toBeUndefined();
    expect(notify).not.toHaveBeenCalled();
  });

  it('runs when the technician completes their job', async () => {
    const { service } = subject([], []);
    jest.spyOn(service as any, 'updateStatus').mockResolvedValue({ status: 'COMPLETED' });
    const announce = jest.spyOn(service, 'announceOpenJobsToFreedTechnician').mockResolvedValue(undefined);
    await expect(service.completeTechnicianJob('ff-user', 'job-1')).resolves.toEqual({ status: 'COMPLETED' });
    expect(announce).toHaveBeenCalledWith('ff-user');
  });
});
