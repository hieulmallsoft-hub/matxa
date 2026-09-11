import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PrismaService } from '../../database/prisma.service';
import { FIREBASE_ADMIN } from '../auth/firebase/firebase-admin.provider';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { TestPushDto } from './dto/test-push.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FIREBASE_ADMIN) private readonly firebaseApp: App,
  ) {}

  registerDevice(userId: string, dto: RegisterDeviceTokenDto) {
    return this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: { userId, token: dto.token, platform: dto.platform, deviceId: dto.deviceId },
      update: { userId, platform: dto.platform, deviceId: dto.deviceId, lastSeenAt: new Date() },
      select: { id: true, platform: true, deviceId: true, createdAt: true, lastSeenAt: true },
    });
  }

  async removeDevice(userId: string, token: string) {
    const result = await this.prisma.deviceToken.deleteMany({ where: { userId, token } });
    return { deleted: result.count };
  }

  async sendTestPush(userId: string, dto: TestPushDto) {
    const title = dto.title ?? 'Matxa test notification';
    const body = dto.body ?? 'Firebase Cloud Messaging da hoat dong.';
    const notification = await this.create(userId, 'TEST', title, body, 'matxa://notifications');
    const result = await this.sendPush(userId, title, body, { notificationId: notification.id, type: 'TEST', actionUrl: 'matxa://notifications' });
    return { notificationId: notification.id, ...result };
  }

  async sendPush(userId: string, title: string, body: string, data: Record<string, string> = {}) {
    const devices = await this.prisma.deviceToken.findMany({ where: { userId }, select: { token: true } });
    if (devices.length === 0) return { deviceCount: 0, successCount: 0, failureCount: 0 };

    const tokens = devices.map((device) => device.token);
    const response = await getMessaging(this.firebaseApp).sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
      android: { priority: 'high', notification: { channelId: 'matxa_notifications' } },
    });
    const invalidTokens = response.responses.flatMap((item, index) => {
      const code = item.error?.code;
      return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token'
        ? [tokens[index]]
        : [];
    });
    if (invalidTokens.length > 0) {
      await this.prisma.deviceToken.deleteMany({ where: { token: { in: invalidTokens } } });
    }
    return { deviceCount: tokens.length, successCount: response.successCount, failureCount: response.failureCount };
  }

  async list(userId: string, query: ListNotificationsDto) {
    const where = { userId, ...(query.unreadOnly ? { readAt: null } : {}) };
    const [items, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, unreadCount, total, page: query.page, limit: query.limit };
  }

  async markRead(userId: string, id: string) {
    const result = await this.prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
    if (result.count === 0) throw new NotFoundException('Thong bao khong ton tai');
    return this.prisma.notification.findUniqueOrThrow({ where: { id } });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { updated: result.count };
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.prisma.notification.deleteMany({ where: { id, userId } });
    if (result.count === 0) throw new NotFoundException('Thong bao khong ton tai');
  }

  async removeAll(userId: string) {
    const result = await this.prisma.notification.deleteMany({ where: { userId } });
    return { deleted: result.count };
  }

  create(userId: string, type: string, title: string, body: string, actionUrl?: string) {
    return this.prisma.notification.create({ data: { userId, type, title, body, actionUrl } });
  }
}
