import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { ChatGateway } from '../gateways/chat.gateway';
import { ChatStorageService } from './chat-storage.service';

const HOUR_MS = 60 * 60 * 1000;

export type SupportChatEndReason = 'AGENT_ENDED' | 'IDLE';

/**
 * A support chat is one session: it ends when an admin closes it or after SUPPORT_CHAT_IDLE_HOURS
 * without a message (default 24; 0 disables). Ending deletes the thread, its messages, images and
 * the notifications that quote them, so the customer's next "Chat ngay" starts a fresh thread.
 * Deleting is idempotent, so several PM2/Nest instances may run the idle sweep.
 */
@Injectable()
export class SupportChatRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SupportChatRetentionService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: ChatStorageService,
    private readonly gateway: ChatGateway,
  ) {}

  onModuleInit() {
    const intervalMs = Number(this.config.get('SUPPORT_CHAT_IDLE_CHECK_MINUTES', 10)) * 60_000;
    this.timer = setInterval(
      () =>
        void this.run().catch((error) =>
          this.logger.error('Support chat idle sweep failed', error instanceof Error ? error.stack : undefined),
        ),
      intervalMs,
    );
    void this.run().catch((error) =>
      this.logger.error('Initial support chat idle sweep failed', error instanceof Error ? error.stack : undefined),
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Admin "Kết thúc hỗ trợ". */
  async endByAdmin(adminId: string, conversationId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId }, select: { role: true, status: true } });
    if (admin?.role !== 'ADMIN' || admin.status !== 'ACTIVE') throw new ForbiddenException('Chi admin duoc ket thuc ho tro');
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { type: true } });
    if (!conversation) throw new NotFoundException('Cuoc tro chuyen khong ton tai');
    if (conversation.type !== 'SUPPORT') throw new BadRequestException('Chi ket thuc duoc chat ho tro');
    await this.end(conversationId, 'AGENT_ENDED');
    return { conversationId, ended: true };
  }

  /** Closes every support thread idle for longer than SUPPORT_CHAT_IDLE_HOURS; returns how many. */
  async run(now = new Date()) {
    const hours = Number(this.config.get('SUPPORT_CHAT_IDLE_HOURS', 24));
    if (!Number.isFinite(hours) || hours <= 0) return 0;
    const cutoff = new Date(now.getTime() - hours * HOUR_MS);
    const idle = await this.prisma.conversation.findMany({
      where: {
        type: 'SUPPORT',
        OR: [{ lastMessageAt: { lt: cutoff } }, { lastMessageAt: null, createdAt: { lt: cutoff } }],
      },
      select: { id: true },
    });
    let ended = 0;
    for (const { id } of idle) {
      if (await this.end(id, 'IDLE')) ended += 1;
    }
    if (ended) this.logger.log(`Ended ${ended} support conversation(s) idle since ${cutoff.toISOString()}`);
    return ended;
  }

  private async end(conversationId: string, reason: SupportChatEndReason) {
    const [members, images] = await Promise.all([
      this.prisma.conversationMember.findMany({ where: { conversationId }, select: { userId: true } }),
      this.prisma.message.findMany({ where: { conversationId, mediaKey: { not: null } }, select: { mediaKey: true } }),
    ]);
    const [, deleted] = await this.prisma.$transaction([
      // Chat notifications quote the message text, so they go with the thread.
      this.prisma.notification.deleteMany({ where: { actionUrl: `matxa://chat/${conversationId}` } }),
      // Messages and members cascade with the conversation.
      this.prisma.conversation.deleteMany({ where: { id: conversationId, type: 'SUPPORT' } }),
    ]);
    if (!deleted.count) return false;
    await this.storage.deleteObjects(images.map((image) => image.mediaKey!));
    this.gateway.publishConversationEnded(conversationId, members.map((member) => member.userId), reason);
    return true;
  }
}
