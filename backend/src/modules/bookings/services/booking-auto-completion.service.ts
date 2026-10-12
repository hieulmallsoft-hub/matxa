import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';

/** Automatically completes confirmed bookings after the post-service grace period. */
@Injectable()
export class BookingAutoCompletionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingAutoCompletionService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const intervalMs = Number(this.config.get('BOOKING_AUTO_COMPLETE_INTERVAL_SECONDS', 60)) * 1000;
    this.timer = setInterval(
      () =>
        void this.run().catch((error) =>
          this.logger.error('Booking auto-completion worker failed', error instanceof Error ? error.stack : undefined),
        ),
      intervalMs,
    );
    void this.run().catch((error) =>
      this.logger.error('Initial booking auto-completion failed', error instanceof Error ? error.stack : undefined),
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(now = new Date()) {
    const graceHours = Number(this.config.get('BOOKING_AUTO_COMPLETE_AFTER_HOURS', 24));
    const cutoff = new Date(now.getTime() - graceHours * 60 * 60 * 1000);
    const take = Number(this.config.get('BOOKING_AUTO_COMPLETE_BATCH_SIZE', 100));
    const due = await this.prisma.booking.findMany({
      where: { status: 'CONFIRMED', scheduledEnd: { lte: cutoff } },
      select: { id: true, customerId: true, technician: { select: { userId: true } } },
      orderBy: { scheduledEnd: 'asc' },
      take,
    });
    let completed = 0;
    for (const booking of due) {
      const updated = await this.prisma.booking.updateMany({
        where: { id: booking.id, status: 'CONFIRMED', scheduledEnd: { lte: cutoff } },
        data: { status: 'COMPLETED' },
      });
      if (!updated.count) continue;
      completed++;
      await this.notifyCompleted(booking.customerId, booking.technician?.userId ?? null, booking.id);
    }
    return { scanned: due.length, completed };
  }

  private async notifyCompleted(customerId: string, technicianUserId: string | null, bookingId: string) {
    const type = 'BOOKING_AUTO_COMPLETED';
    const title = 'Đơn đã tự hoàn thành';
    const body = 'Đơn đã được hệ thống tự hoàn thành sau 24 giờ.';
    const data = { type, bookingId, automatic: 'true' };
    const recipients = [customerId, technicianUserId].filter((id): id is string => Boolean(id));
    await Promise.all(
      recipients.map(async (userId) => {
        await this.notifications.create(userId, type, title, body, `matxa://bookings/${bookingId}`);
        await this.notifications.sendPush(userId, title, body, data);
      }),
    );
  }
}
