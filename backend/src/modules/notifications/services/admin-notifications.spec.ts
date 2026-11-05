import { NotificationsService } from './notifications.service';
import { BookingsService } from '../../bookings/services/bookings.service';
import { TechnicianApplicationsService } from '../../marketplace/services/technician-applications.service';

describe('admin notifications', () => {
  it('creates one in-app notification per active admin', async () => {
    const prisma: any = {
      userIdentity: { findFirst: jest.fn().mockResolvedValue({ id: 'phone-1' }) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]) },
      notification: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const service = new NotificationsService(prisma, {} as never);
    await expect(service.notifyAdmins('ADMIN_COMPLAINT_CREATED', 'Khiếu nại mới', 'Chi tiết', 'admin://complaints')).resolves.toBe(2);
    expect(prisma.user.findMany).toHaveBeenCalledWith({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: ['admin-1', 'admin-2'].map((userId) => ({
        userId, type: 'ADMIN_COMPLAINT_CREATED', title: 'Khiếu nại mới', body: 'Chi tiết', actionUrl: 'admin://complaints',
      })),
    });
  });

  it('never throws, so the triggering action still succeeds', async () => {
    const prisma: any = { user: { findMany: jest.fn().mockRejectedValue(new Error('db down')) } };
    await expect(new NotificationsService(prisma, {} as never).notifyAdmins('X', 'T', 'B')).resolves.toBe(0);
  });

  it('notifies admins when a technician submits an application', async () => {
    const prisma: any = {
      userIdentity: { findFirst: jest.fn().mockResolvedValue({ id: 'phone-1' }) },
      technicianApplication: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'app-1', status: 'DRAFT', displayName: 'Lan', idCardNumber: '1', idCardFrontKey: 'f', idCardBackKey: 'b', faceImageKey: 'x',
        }),
        update: jest.fn().mockResolvedValue({ id: 'app-1', status: 'SUBMITTED' }),
      },
      technicianKyc: { upsert: jest.fn() },
    };
    const notifications: any = { notifyAdmins: jest.fn() };
    await new TechnicianApplicationsService(prisma, {} as any, notifications).submit('user-1');
    expect(notifications.notifyAdmins).toHaveBeenCalledWith('ADMIN_APPLICATION_SUBMITTED', 'Hồ sơ KTV mới chờ duyệt', expect.stringContaining('Lan'), 'admin://applications');
  });

  it('notifies admins about a new complaint and an expired open booking', async () => {
    const tx: any = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({ id: 'booking-1', customerId: 'customer-1', applicationDeadlineAt: new Date('2026-10-06T00:00:00Z') }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      bookingTechnicianApplication: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma: any = {
      userIdentity: { findFirst: jest.fn().mockResolvedValue({ id: 'phone-1' }) },
      $transaction: jest.fn((callback: any) => callback(tx)),
      booking: { findFirst: jest.fn().mockResolvedValue({ id: 'booking-1', status: 'COMPLETED', complaint: null }) },
      complaint: { create: jest.fn().mockResolvedValue({ id: 'complaint-1' }) },
      conversation: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'conversation-1' }) },
    };
    const notifications: any = { create: jest.fn().mockResolvedValue({}), sendPush: jest.fn().mockResolvedValue({}), notifyAdmins: jest.fn() };
    const service = new BookingsService(prisma, { get: jest.fn() } as any, notifications, {} as any);

    await service.createComplaint('customer-1', 'booking-1', { reasonCode: 'OTHER', detail: 'KTV đến muộn', contactEmail: 'a@b.vn' } as any);
    expect(notifications.notifyAdmins).toHaveBeenCalledWith('ADMIN_COMPLAINT_CREATED', 'Khiếu nại mới', expect.stringContaining('KTV đến muộn'), 'admin://complaints');

    await service.expireOpenBookingIfDue('booking-1', new Date('2026-10-06T01:00:00Z'));
    expect(notifications.notifyAdmins).toHaveBeenCalledWith('ADMIN_BOOKING_EXPIRED', 'Đơn hết hạn chưa có KTV', expect.any(String), 'admin://orders');
  });
});
