import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { BookingsService } from './bookings.service';

/**
 * A small, idempotent poller. Each terminal transition is claimed in PostgreSQL
 * with a conditional update, so several PM2/Nest instances may run this safely.
 */
@Injectable()
export class OpenBookingExpirationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OpenBookingExpirationService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookings: BookingsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const intervalMs = Number(this.config.get('OPEN_BOOKING_EXPIRATION_INTERVAL_SECONDS', 60)) * 1000;
    this.timer = setInterval(
      () =>
        void this.run().catch((error) =>
          this.logger.error('Open booking expiration worker failed', error instanceof Error ? error.stack : undefined),
        ),
      intervalMs,
    );
    void this.run().catch((error) =>
      this.logger.error('Initial open booking expiration failed', error instanceof Error ? error.stack : undefined),
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(now = new Date()) {
    const take = Number(this.config.get('OPEN_BOOKING_EXPIRATION_BATCH_SIZE', 100));
    const due = await this.prisma.booking.findMany({
      where: {
        assignmentMode: 'OPEN_MARKETPLACE',
        status: 'OPEN',
        technicianId: null,
        applicationDeadlineAt: { lte: now },
      },
      select: { id: true },
      orderBy: { applicationDeadlineAt: 'asc' },
      take,
    });
    let expired = 0;
    for (const booking of due) {
      const result = await this.bookings.expireOpenBookingIfDue(booking.id, now);
      if (result) {
        expired++;
        this.logger.log(
          `Expired open booking ${booking.id}; deadline=${result.deadline.toISOString()}; applied=${result.applicationCount}`,
        );
      }
    }
    return { scanned: due.length, expired };
  }
}
