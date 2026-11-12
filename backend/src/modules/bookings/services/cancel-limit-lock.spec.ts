import { BookingsService } from './bookings.service';

// While locked for cancelling too much, a customer cannot book and a technician cannot take jobs.
describe('cancel-limit lock on new bookings and jobs', () => {
  const recentCancels = [0.1, 0.5, 1].map((h) => ({ cancelledAt: new Date(Date.now() - h * 3_600_000) }));
  const subject = (cancels = recentCancels) => {
    const prisma: any = {
      booking: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue(cancels) },
      technicianProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'profile-1' }) },
    };
    const settings = {
      getBookingRules: jest.fn().mockResolvedValue({
        minAdvanceHours: 0, maxDispatchRadiusKm: 0, requireTechnicianPhone: false,
        enabledServiceModes: ['HOME', 'ONLINE', 'ONSITE'],
        cancelLimitCount: 3, cancelLimitWindowHours: 24, cancelLockHours: 3,
      }),
    };
    const service = new BookingsService(prisma, { get: (_k: string, f: unknown) => f } as any, {} as any, {} as any, undefined, undefined, undefined, settings as any);
    jest.spyOn(service as any, 'assertCustomer').mockResolvedValue(undefined);
    return { service: service as any, prisma };
  };
  const code = (promise: Promise<unknown>) => promise.then(() => null, (error) => error.getResponse?.().code ?? error.message);

  it('refuses a new booking from a locked customer', async () => {
    const { service } = subject();
    await expect(code(service.createOpen('customer-1', { scheduledStart: new Date(Date.now() + 86_400_000).toISOString(), mode: 'HOME' })))
      .resolves.toBe('CANCEL_LIMIT_LOCKED');
  });

  it('refuses applying to or accepting a job from a locked technician', async () => {
    const { service } = subject();
    await expect(code(service.applyToOpenJob('tech-user-1', 'booking-1'))).resolves.toBe('CANCEL_LIMIT_LOCKED');
    await expect(code(service.acceptTechnicianJob('tech-user-1', 'booking-1'))).resolves.toBe('CANCEL_LIMIT_LOCKED');
  });

  it('lets them through once under the limit', async () => {
    const { service } = subject(recentCancels.slice(0, 2));
    jest.spyOn(service, 'openJobForTechnician').mockRejectedValue(new Error('next check reached'));
    await expect(code(service.applyToOpenJob('tech-user-1', 'booking-1'))).resolves.toBe('next check reached');
  });
});
