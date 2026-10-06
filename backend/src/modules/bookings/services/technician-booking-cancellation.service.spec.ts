import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { TechnicianBookingCancellationService } from './technician-booking-cancellation.service';

const assignedBooking = (overrides: Record<string, unknown> = {}) => ({
  id: 'booking-1', customerId: 'customer-1', technicianId: 'tech-profile-1', assignmentMode: 'DIRECT', status: 'CONFIRMED',
  technician: { userId: 'tech-user-1' }, applications: [], ...overrides,
});

function createSubject(booking = assignedBooking()) {
  const tx: any = {
    booking: { findUnique: jest.fn().mockResolvedValue(booking), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    technicianProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'tech-profile-1' }) },
    bookingCancellation: { create: jest.fn().mockResolvedValue({ id: 'cancellation-1' }) },
  };
  const prisma: any = {
    booking: { findUnique: jest.fn().mockResolvedValue(booking) },
    technicianProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'tech-profile-1' }) },
    $transaction: jest.fn((callback: any) => callback(tx)),
  };
  const storage = { createUploadUrl: jest.fn(), validateKeys: jest.fn().mockResolvedValue(undefined) };
  const notifications = { create: jest.fn().mockResolvedValue({}), sendPush: jest.fn().mockResolvedValue({}) };
  return { service: new TechnicianBookingCancellationService(prisma, storage as any, notifications as any), prisma, tx, storage, notifications };
}

describe('TechnicianBookingCancellationService', () => {
  const otherReason = { reasonCode: 'OTHER' as const, reasonText: 'Khong the phuc vu', evidenceStorageKeys: [] };

  it('lets the assigned DIRECT technician cancel and writes the legacy fields plus audit', async () => {
    const { service, tx, storage } = createSubject();
    const response = await service.cancel('tech-user-1', 'booking-1', otherReason);

    expect(storage.validateKeys).toHaveBeenCalledWith('booking-1', 'tech-user-1', []);
    expect(tx.bookingCancellation.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ bookingId: 'booking-1', actorUserId: 'tech-user-1', actorRole: 'TECHNICIAN' }) }));
    expect(tx.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED', cancelledByRole: 'TECHNICIAN', cancellationReasonCode: 'OTHER' }) }));
    expect(response).toMatchObject({ bookingId: 'booking-1', status: 'CANCELLED', cancellation: { actor: 'TECHNICIAN', reasonCode: 'OTHER' } });
  });

  it('rejects a different DIRECT technician', async () => {
    const { service } = createSubject();
    await expect(service.cancel('another-tech-user', 'booking-1', otherReason)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an OPEN booking only when this assigned profile has a SELECTED application', async () => {
    const booking = assignedBooking({ assignmentMode: 'OPEN_MARKETPLACE', applications: [{ technicianProfileId: 'tech-profile-1' }] });
    const { service } = createSubject(booking);
    await expect(service.cancel('tech-user-1', 'booking-1', otherReason)).resolves.toMatchObject({ status: 'CANCELLED' });
  });

  it.each(['APPLIED', 'NOT_SELECTED', 'WITHDRAWN', 'DECLINED', 'EXPIRED'])('rejects OPEN applicant with %s status', async () => {
    const booking = assignedBooking({ assignmentMode: 'OPEN_MARKETPLACE', applications: [] });
    const { service } = createSubject(booking);
    await expect(service.cancel('tech-user-1', 'booking-1', otherReason)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(['CUSTOMER_NO_SHOW', 'UNSAFE_SITUATION', 'INAPPROPRIATE_REQUEST'] as const)('requires evidence for %s', async (reasonCode) => {
    const { service } = createSubject();
    await expect(service.cancel('tech-user-1', 'booking-1', { reasonCode, evidenceStorageKeys: [] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires text for OTHER', async () => {
    const { service } = createSubject();
    await expect(service.cancel('tech-user-1', 'booking-1', { reasonCode: 'OTHER', evidenceStorageKeys: [] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects completed and already cancelled bookings without an audit insert', async () => {
    for (const status of ['COMPLETED', 'CANCELLED']) {
      const { service, tx } = createSubject(assignedBooking({ status }));
      await expect(service.cancel('tech-user-1', 'booking-1', otherReason)).rejects.toBeInstanceOf(ConflictException);
      expect(tx.bookingCancellation.create).not.toHaveBeenCalled();
    }
  });

  it('does not roll back a cancellation if push delivery fails', async () => {
    const { service, tx, notifications } = createSubject();
    notifications.sendPush.mockRejectedValueOnce(new Error('fcm unavailable'));
    await expect(service.cancel('tech-user-1', 'booking-1', otherReason)).resolves.toMatchObject({ status: 'CANCELLED' });
    expect(tx.booking.updateMany).toHaveBeenCalled();
  });
});
