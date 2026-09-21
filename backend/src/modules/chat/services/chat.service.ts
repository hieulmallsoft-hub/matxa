import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { CreateConversationDto, EditMessageDto, ListMessagesDto, SendMessageDto } from '../dto/chat.dto';

const EDIT_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async createConversation(userId: string, dto: CreateConversationDto) {
    if (dto.participantId === userId) throw new BadRequestException('Khong the tu nhan tin cho chinh minh');
    const participant = await this.prisma.user.findFirst({
      where: { id: dto.participantId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!participant) throw new NotFoundException('Nguoi nhan khong ton tai');

    const participantKey = [userId, dto.participantId].sort().join(':');
    const conversation = await this.prisma.conversation.upsert({
      where: { participantKey },
      update: {},
      create: {
        participantKey,
        members: { create: [{ userId }, { userId: dto.participantId }] },
      },
      include: { members: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
    });
    await this.prisma.conversationMember.updateMany({
      where: { conversationId: conversation.id },
      data: { hiddenAt: null },
    });
    return conversation;
  }

  async listConversations(userId: string) {
    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId, hiddenAt: null },
      orderBy: { conversation: { lastMessageAt: 'desc' } },
      include: {
        conversation: {
          include: {
            members: { where: { userId: { not: userId } }, include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });
    return Promise.all(memberships.map(async ({ conversation, lastReadAt }) => ({
      id: conversation.id,
      participant: conversation.members[0]?.user,
      lastMessage: conversation.messages[0] ?? null,
      lastMessageAt: conversation.lastMessageAt,
      unreadCount: await this.prisma.message.count({
        where: {
          conversationId: conversation.id,
          senderId: { not: userId },
          recalledAt: null,
          ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
        },
      }),
    })));
  }

  async listMessages(userId: string, conversationId: string, query: ListMessagesDto) {
    const access = await this.ensureAccess(userId, conversationId);
    const where = {
      conversationId,
      ...(access.member?.hiddenAt ? { createdAt: { gt: access.member.hiddenAt } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }),
      this.prisma.message.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async sendMessage(userId: string, conversationId: string, dto: SendMessageDto, notify = true) {
    await this.ensureMember(userId, conversationId);
    this.validateMessage(conversationId, dto);
    const now = new Date();
    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          type: dto.type,
          text: dto.type === 'TEXT' ? dto.text!.trim() : undefined,
          mediaUrl: dto.type === 'IMAGE' ? dto.mediaUrl : undefined,
          mediaKey: dto.type === 'IMAGE' ? dto.mediaKey : undefined,
          latitude: dto.type === 'LOCATION' ? dto.latitude : undefined,
          longitude: dto.type === 'LOCATION' ? dto.longitude : undefined,
          address: dto.type === 'LOCATION' ? dto.address : undefined,
          bookingId: dto.bookingId,
        },
      });
      await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } });
      await tx.conversationMember.updateMany({ where: { conversationId }, data: { hiddenAt: null } });
      return created;
    });
    if (notify) this.notifyInBackground(userId, conversationId, message.id, dto, true);
    return message;
  }

  async markDelivered(messageId: string) {
    return this.prisma.message.updateMany({
      where: { id: messageId, deliveredAt: null },
      data: { deliveredAt: new Date() },
    });
  }

  async editMessage(userId: string, messageId: string, dto: EditMessageDto) {
    const message = await this.ownEditableMessage(userId, messageId);
    if (message.type !== 'TEXT') throw new BadRequestException('Chi co the sua tin nhan van ban');
    const text = dto.text.trim();
    if (!text) throw new BadRequestException('Noi dung tin nhan khong duoc de trong');
    return this.prisma.message.update({ where: { id: messageId }, data: { text, editedAt: new Date() } });
  }

  async recallMessage(userId: string, messageId: string) {
    await this.ownEditableMessage(userId, messageId);
    return this.prisma.message.update({
      where: { id: messageId },
      data: { recalledAt: new Date(), text: null, mediaUrl: null, mediaKey: null, latitude: null, longitude: null, address: null },
    });
  }

  async markRead(userId: string, conversationId: string) {
    await this.ensureMember(userId, conversationId);
    const now = new Date();
    const result = await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: now, deliveredAt: now },
    });
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: now },
    });
    return { updated: result.count, readAt: now };
  }

  async hideConversation(userId: string, conversationId: string) {
    await this.ensureMember(userId, conversationId);
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { hiddenAt: new Date() },
    });
  }

  async recipientIds(userId: string, conversationId: string) {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId, userId: { not: userId } },
      select: { userId: true },
    });
    return members.map((member) => member.userId);
  }

  async ensureMember(userId: string, conversationId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) throw new ForbiddenException('Ban khong thuoc cuoc tro chuyen nay');
    return member;
  }

  private async ensureAccess(userId: string, conversationId: string) {
    const [member, user, conversation] = await Promise.all([
      this.prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId } } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
      this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { id: true } }),
    ]);
    if (!conversation) throw new NotFoundException('Cuoc tro chuyen khong ton tai');
    if (!member && user?.role !== 'ADMIN') throw new ForbiddenException('Ban khong co quyen xem cuoc tro chuyen');
    return { member, isAdmin: user?.role === 'ADMIN' };
  }

  private validateMessage(conversationId: string, dto: SendMessageDto) {
    if (dto.type === 'TEXT' && !dto.text?.trim()) throw new BadRequestException('Noi dung tin nhan khong duoc de trong');
    if (dto.type === 'IMAGE' && (!dto.mediaUrl || !dto.mediaKey?.startsWith(`chat/${conversationId}/`) || !dto.mediaUrl.endsWith(dto.mediaKey))) {
      throw new BadRequestException('Anh khong hop le hoac khong thuoc cuoc tro chuyen');
    }
    if (dto.type === 'LOCATION' && (dto.latitude === undefined || dto.longitude === undefined)) {
      throw new BadRequestException('Tin vi tri phai co latitude va longitude');
    }
  }

  private async ownEditableMessage(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Tin nhan khong ton tai');
    if (message.senderId !== userId) throw new ForbiddenException('Chi nguoi gui moi co the thay doi tin nhan');
    if (message.recalledAt) throw new BadRequestException('Tin nhan da duoc thu hoi');
    if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) throw new BadRequestException('Da qua 15 phut de sua hoac thu hoi');
    return message;
  }

  notifyInBackground(senderId: string, conversationId: string, messageId: string, dto: SendMessageDto, push: boolean) {
    void this.notifyRecipients(senderId, conversationId, messageId, dto, push).catch((error: unknown) => {
      this.logger.warn(`Khong the tao thong bao cho tin nhan ${messageId}: ${error instanceof Error ? error.message : 'unknown'}`);
    });
  }

  private async notifyRecipients(senderId: string, conversationId: string, messageId: string, dto: SendMessageDto, push: boolean) {
    const [sender, recipients] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: senderId }, select: { displayName: true } }),
      this.recipientIds(senderId, conversationId),
    ]);
    const title = sender?.displayName ?? 'Ban co tin nhan moi';
    const body = dto.type === 'TEXT' ? dto.text!.trim().slice(0, 200) : dto.type === 'IMAGE' ? 'Da gui mot hinh anh' : 'Da gui vi tri';
    await Promise.all(recipients.map(async (recipientId) => {
      await this.notifications.create(recipientId, 'CHAT_MESSAGE', title, body, `matxa://chat/${conversationId}`);
      if (push) await this.notifications.sendPush(recipientId, title, body, { type: 'CHAT_MESSAGE', conversationId, messageId });
    }));
  }
}
