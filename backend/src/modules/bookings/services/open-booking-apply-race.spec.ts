import { ConflictException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
// Suspensions are covered by cancel-limit.spec; here nobody is suspended.
jest.mock('./cancel-limit', () => ({
  ...jest.requireActual('./cancel-limit'),
  activeSuspension: jest.fn().mockResolvedValue(null),
  assertNotSuspended: jest.fn().mockResolvedValue(undefined),
  applyCancelLimit: jest.fn().mockResolvedValue({ enabled: false, lockedUntil: null }),
}));

// Regression (seen live): the requested technician accepted while another technician applied at the
// same moment; the second one was told "APPLIED" on a booking that had just been confirmed.
describe('applying while the booking is being taken', () => {
  const booking = {
    id: 'booking-1', customerId: 'customer-1', status: 'OPEN', assignmentMode: 'OPEN_MARKETPLACE',
    requestedTechnicianId: 'duc-profile', grossServiceAmount: 600000,
  };
  const subject = (stillOpen: boolean) => {
    const tx: any = {
      // Touching the booking row locks it, so this waits for a concurrent assignment and then sees its result.
      booking: { updateMany: jest.fn().mockResolvedValue({ count: stillOpen ? 1 : 0 }) },
      bookingTechnicianApplication: { create: jest.fn(async ({ data }: any) => ({ id: 'application', ...data })) },
    };
    const prisma: any = {
      userIdentity: { findFirst: jest.fn().mockResolvedValue({ id: 'phone-1' }) },
      $transaction: jest.fn((callback: any) => callback(tx)),
      bookingTechnicianApplication: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service: any = new BookingsService(prisma, { get: (_k: string, f: unknown) => f } as any, {} as any, {} as any);
    jest.spyOn(service, 'requireActiveTechnician').mockResolvedValue({ id: 'fftools-profile' });
    jest.spyOn(service, 'openJobForTechnician').mockResolvedValue(booking);
    jest.spyOn(service, 'commissionFor').mockResolvedValue(0);
    jest.spyOn(service, 'notifyStatus').mockResolvedValue(undefined);
    return { service, tx };
  };

  it('refuses the application when the booking was taken in the meantime', async () => {
    const { service, tx } = subject(false);
    await expect(service.applyToOpenJob('fftools-user', 'booking-1')).rejects.toThrow(
      new ConflictException('Don khong con mo de ung tuyen'),
    );
    expect(tx.bookingTechnicianApplication.create).not.toHaveBeenCalled();
  });

  it('claims the open booking row and records the application in one transaction', async () => {
    const { service, tx } = subject(true);
    await expect(service.applyToOpenJob('fftools-user', 'booking-1')).resolves.toMatchObject({ status: 'APPLIED' });
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'booking-1', status: 'OPEN', technicianId: null }),
      data: { status: 'OPEN' },
    });
    expect(tx.bookingTechnicianApplication.create).toHaveBeenCalled();
  });
});
