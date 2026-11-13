import { BookingsService } from './bookings.service';
// Suspensions are covered by cancel-limit.spec; here nobody is suspended.
jest.mock('./cancel-limit', () => ({
  ...jest.requireActual('./cancel-limit'),
  activeSuspension: jest.fn().mockResolvedValue(null),
  assertNotSuspended: jest.fn().mockResolvedValue(undefined),
  applyCancelLimit: jest.fn().mockResolvedValue({ enabled: false, lockedUntil: null }),
}));

// The technician the customer picked confirms the booking by accepting it; everyone else who
// applied is only a fallback for when that technician declines or does not answer in time.
describe('requested technician accepts an open booking', () => {
  const booking = {
    id: 'booking-1', customerId: 'customer-1', status: 'OPEN', assignmentMode: 'OPEN_MARKETPLACE',
    requestedTechnicianId: 'duc-profile', grossServiceAmount: 800000,
  };

  const subject = (profileId: string, existing: any = null) => {
    const prisma: any = {
      userIdentity: { findFirst: jest.fn().mockResolvedValue({ id: 'phone-1' }) },
      bookingTechnicianApplication: {
        findUnique: jest.fn().mockResolvedValue(existing),
        create: jest.fn(async ({ data }: any) => ({ id: `${data.technicianProfileId}-application`, ...data })),
      },
      wallet: { findUnique: jest.fn().mockResolvedValue({ balanceVnd: 1_000_000 }) },
      user: { findUnique: jest.fn().mockResolvedValue({ displayName: 'Duc Nguyen' }) },
      booking: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    prisma.$transaction = jest.fn((callback: any) => callback(prisma));
    const service: any = new BookingsService(
      prisma, { get: (_key: string, fallback: unknown) => fallback } as any, {} as any, {} as any,
    );
    jest.spyOn(service, 'requireActiveTechnician').mockResolvedValue({ id: profileId });
    jest.spyOn(service, 'openJobForTechnician').mockResolvedValue(booking);
    jest.spyOn(service, 'commissionFor').mockResolvedValue(200000);
    const notify = jest.spyOn(service, 'notifyStatus').mockResolvedValue(undefined);
    const assign = jest.spyOn(service, 'assignOpenBooking').mockResolvedValue({
      booking: { ...booking, status: 'CONFIRMED', technicianId: profileId },
      winnerUserId: 'duc-user',
      loserUserIds: ['fftools-user'],
    });
    return { service, prisma, notify, assign };
  };

  it('confirms the booking for the requested technician as soon as they accept', async () => {
    const { service, notify, assign } = subject('duc-profile');
    await expect(service.applyToOpenJob('duc-user', 'booking-1')).resolves.toMatchObject({
      status: 'SELECTED',
      bookingStatus: 'CONFIRMED',
    });
    expect(assign).toHaveBeenCalledWith('booking-1', 'duc-profile-application', 'customer-1');
    expect(notify).toHaveBeenCalledWith(
      'customer-1', 'booking-1', 'REQUESTED_TECHNICIAN_ACCEPTED', 'KTV đã nhận đơn', 'Duc Nguyen đã nhận đơn của bạn.',
    );
    expect(notify).toHaveBeenCalledWith(
      'fftools-user', 'booking-1', 'TECHNICIAN_NOT_SELECTED', expect.any(String), expect.any(String),
    );
    expect(notify).not.toHaveBeenCalledWith('customer-1', 'booking-1', 'TECHNICIAN_APPLIED', expect.anything(), expect.anything());
  });

  it('also confirms when the requested technician had applied before this change', async () => {
    const { service, assign } = subject('duc-profile', { id: 'old-application', status: 'APPLIED' });
    await expect(service.applyToOpenJob('duc-user', 'booking-1')).resolves.toMatchObject({ bookingStatus: 'CONFIRMED' });
    expect(assign).toHaveBeenCalledWith('booking-1', 'old-application', 'customer-1');
  });

  it('keeps other technicians as applicants waiting for the customer', async () => {
    const { service, notify, assign } = subject('fftools-profile');
    await expect(service.applyToOpenJob('fftools-user', 'booking-1')).resolves.toMatchObject({ status: 'APPLIED' });
    expect(assign).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith('customer-1', 'booking-1', 'TECHNICIAN_APPLIED', expect.any(String), expect.any(String));
  });
});
