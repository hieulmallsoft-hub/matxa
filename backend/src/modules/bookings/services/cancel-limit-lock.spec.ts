import { BookingsService } from './bookings.service';

// While suspended, a customer cannot book and a technician cannot take jobs (they can still sign in).
describe('suspension blocks new bookings and jobs', () => {
  const subject = (suspended: boolean) => {
    const suspension = suspended ? { level: 1, reason: 'Huy 3 don', endsAt: new Date(Date.now() + 3_600_000) } : null;
    const prisma: any = {
      booking: { findFirst: jest.fn().mockResolvedValue(null) },
      technicianProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'profile-1' }) },
      userSuspension: { findFirst: jest.fn().mockResolvedValue(suspension) },
    };
    const settings = {
      getBookingRules: jest.fn().mockResolvedValue({
        minAdvanceHours: 0, maxDispatchRadiusKm: 0, requireTechnicianPhone: false, enabledServiceModes: ['HOME', 'ONLINE', 'ONSITE'],
        cancelLimitCount: 3, cancelLimitWindowHours: 24, suspensionHours: [3, 24, 168], suspensionResetDays: 30,
      }),
    };
    const service = new BookingsService(prisma, { get: (_k: string, f: unknown) => f } as any, {} as any, {} as any, undefined, undefined, undefined, settings as any);
    jest.spyOn(service as any, 'assertCustomer').mockResolvedValue(undefined);
    return service as any;
  };
  const code = (promise: Promise<unknown>) => promise.then(() => null, (error) => error.getResponse?.().code ?? error.message);

  it('refuses a new booking from a suspended customer', async () => {
    await expect(code(subject(true).createOpen('customer-1', { scheduledStart: new Date(Date.now() + 86_400_000).toISOString(), mode: 'HOME' })))
      .resolves.toBe('ACCOUNT_SUSPENDED');
  });

  it('refuses applying to or accepting a job from a suspended technician', async () => {
    const service = subject(true);
    await expect(code(service.applyToOpenJob('tech-user-1', 'booking-1'))).resolves.toBe('ACCOUNT_SUSPENDED');
    await expect(code(service.acceptTechnicianJob('tech-user-1', 'booking-1'))).resolves.toBe('ACCOUNT_SUSPENDED');
  });

  it('lets them through when not suspended', async () => {
    const service = subject(false);
    jest.spyOn(service, 'openJobForTechnician').mockRejectedValue(new Error('next check reached'));
    await expect(code(service.applyToOpenJob('tech-user-1', 'booking-1'))).resolves.toBe('next check reached');
  });
});
