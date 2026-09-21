import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const notification = {
    findMany: jest.fn(), count: jest.fn(), updateMany: jest.fn(),
    findUniqueOrThrow: jest.fn(), deleteMany: jest.fn(), create: jest.fn(),
  };
  const deviceToken = {
    upsert: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn(),
  };
  const prisma = { notification, deviceToken, $transaction: jest.fn() };
  const service = new NotificationsService(prisma as never, {} as never);

  beforeEach(() => jest.clearAllMocks());

  it('returns only the requested user page with unread count', async () => {
    prisma.$transaction.mockResolvedValue([[{ id: 'n1' }], 1, 1]);
    await expect(service.list('user-1', { page: 2, limit: 10, unreadOnly: false })).resolves.toEqual({
      items: [{ id: 'n1' }], total: 1, unreadCount: 1, page: 2, limit: 10,
    });
    expect(notification.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1' }, skip: 10, take: 10 }));
  });

  it('does not mark a notification owned by another user', async () => {
    notification.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.markRead('user-1', 'notification-id')).rejects.toBeInstanceOf(NotFoundException);
    expect(notification.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'notification-id', userId: 'user-1' } }));
  });

  it('deletes only notifications owned by the current user', async () => {
    notification.deleteMany.mockResolvedValue({ count: 3 });
    await expect(service.removeAll('user-1')).resolves.toEqual({ deleted: 3 });
    expect(notification.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });

  it('registers an FCM token for the current user', async () => {
    deviceToken.upsert.mockResolvedValue({ id: 'device-token-id' });
    await service.registerDevice('user-1', {
      token: 'a-valid-fcm-token-that-is-long-enough',
      platform: 'ANDROID',
      deviceId: 'phone-1',
    });
    expect(deviceToken.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { token: 'a-valid-fcm-token-that-is-long-enough' },
      create: expect.objectContaining({ userId: 'user-1', deviceId: 'phone-1' }),
    }));
  });

  it('removes only a token owned by the current user', async () => {
    deviceToken.deleteMany.mockResolvedValue({ count: 1 });
    await expect(service.removeDevice('user-1', 'fcm-token')).resolves.toEqual({ deleted: 1 });
    expect(deviceToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1', token: 'fcm-token' } });
  });
});
