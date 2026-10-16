import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

/** Marks unpaid wallet top-ups as expired even when the mobile app is closed. */
@Injectable()
export class WalletTopupExpirationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WalletTopupExpirationService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const intervalMs = Number(this.config.get('WALLET_TOPUP_EXPIRATION_INTERVAL_SECONDS', 30)) * 1000;
    this.timer = setInterval(
      () => void this.run().catch((error) => this.logger.error('Wallet top-up expiration failed', error)),
      intervalMs,
    );
    void this.run().catch((error) => this.logger.error('Initial wallet top-up expiration failed', error));
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(now = new Date()) {
    const batchSize = Number(this.config.get('WALLET_TOPUP_EXPIRATION_BATCH_SIZE', 100));
    const due = await this.prisma.topUpTransaction.findMany({
      where: { status: 'PENDING_PAYMENT', expiresAt: { lte: now } },
      select: { id: true },
      orderBy: { expiresAt: 'asc' },
      take: Number.isInteger(batchSize) && batchSize > 0 ? batchSize : 100,
    });
    if (!due.length) return { scanned: 0, expired: 0 };
    const result = await this.prisma.topUpTransaction.updateMany({
      where: { id: { in: due.map((item) => item.id) }, status: 'PENDING_PAYMENT' },
      data: {
        status: 'EXPIRED',
        failureCode: 'EXPIRED',
        failureMessage: 'Giao dich het han thanh toan',
        processedAt: now,
      },
    });
    return { scanned: due.length, expired: result.count };
  }
}
