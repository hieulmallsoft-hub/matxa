import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes support threads with no message for SUPPORT_CHAT_RETENTION_DAYS (default 90; 0 disables).
 * Messages and members cascade with the conversation, so a customer who comes back later
 * starts a fresh thread. deleteMany is idempotent, so several PM2/Nest instances may run this.
 */
@Injectable()
export class SupportChatRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SupportChatRetentionService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const intervalMs = Number(this.config.get('SUPPORT_CHAT_RETENTION_INTERVAL_MINUTES', 60)) * 60_000;
    this.timer = setInterval(
      () =>
        void this.run().catch((error) =>
          this.logger.error('Support chat retention worker failed', error instanceof Error ? error.stack : undefined),
        ),
      intervalMs,
    );
    void this.run().catch((error) =>
      this.logger.error('Initial support chat retention failed', error instanceof Error ? error.stack : undefined),
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(now = new Date()) {
    const days = Number(this.config.get('SUPPORT_CHAT_RETENTION_DAYS', 90));
    if (!Number.isFinite(days) || days <= 0) return 0;
    const cutoff = new Date(now.getTime() - days * DAY_MS);
    const { count } = await this.prisma.conversation.deleteMany({
      where: {
        type: 'SUPPORT',
        OR: [{ lastMessageAt: { lt: cutoff } }, { lastMessageAt: null, createdAt: { lt: cutoff } }],
      },
    });
    if (count) this.logger.log(`Deleted ${count} support conversation(s) inactive since ${cutoff.toISOString()}`);
    return count;
  }
}
