import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { ChatStorageService } from './chat-storage.service';
import { CreateConversationDto, EditMessageDto, ListMessagesDto, SendMessageDto } from '../dto/chat.dto';

const EDIT_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly storage: ChatStorageService,
  ) {}

  async createConversation(_userId: string, _dto: CreateConversationDto) {
    // New customer/KTV conversations must be created through the booking
    // endpoint. Legacy rows remain readable, but this route must not create a
    // private channel before an assignment exists.
    throw new BadRequestException('Chi ho tro tao chat theo booking');
  }

  /** Opens the only permitted chat for a booking. Participants are always
   * derived from Booking; the client never supplies a technician/customer id. */
  async createBookingConversation(userId: string, bookingId: string) {
    const booking = await this.bookingChatContext(userId, bookingId);
    const technicianUserId = booking.technician!.userId;
    const participantKey = [booking.customerId, technicianUserId].sort().join(':');
    let conversation;
    try {
      conversation = await this.prisma.conversation.upsert({
        where: { bookingId },
        update: {},
        create: {
          bookingId,
          customerId: booking.customerId,
          technicianUserId,
          participantKey,
          lastMessageAt: new Date(),
          members: { create: [{ userId: booking.customerId }, { userId: technicianUserId }] },
          messages: {
            create: {
              senderId: booking.customerId,
              type: 'SYSTEM',
              text: 'TECHNICIAN_SELECTED',
              bookingId,
            },
          },
        },
        include: { members: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
      });
    } catch (error) {
      // A concurrent create is safe because bookingId is unique at database level.
      if ((error as { code?: string }).code !== 'P2002') throw error;
      conversation = await this.prisma.conversation.findUniqueOrThrow({
        where: { bookingId },
        include: { members: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
      });
    }
    await this.prisma.conversationMember.updateMany({ where: { conversationId: conversation.id }, data: { hiddenAt: null } });
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
    const conversationIds = memberships.map(({ conversation }) => conversation.id);
    const unreadMessages = conversationIds.length === 0 ? [] : await this.prisma.message.findMany({
      where: { conversationId: { in: conversationIds }, senderId: { not: userId }, recalledAt: null },
      select: { conversationId: true, createdAt: true },
    });
    const unreadByConversation = new Map<string, number>();
    for (const membership of memberships) {
      const count = unreadMessages.filter((message) => message.conversationId === membership.conversation.id && (!membership.lastReadAt || message.createdAt > membership.lastReadAt)).length;
      unreadByConversation.set(membership.conversation.id, count);
    }
    const visible = [] as Array<Record<string, unknown>>;
    for (const { conversation } of memberships) {
      try {
        // A previous selection can be invalidated by data repair/admin action;
        // do not leave a stale booking thread visible to the wrong KTV.
        await this.ensureMember(userId, conversation.id);
        visible.push({
          id: conversation.id,
          bookingId: conversation.bookingId,
          participant: conversation.members[0]?.user,
          lastMessage: conversation.messages[0] ?? null,
          lastMessageAt: conversation.lastMessageAt,
          unreadCount: unreadByConversation.get(conversation.id) ?? 0,
        });
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
      }
    }
    return visible;
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
    return { items: await Promise.all(items.map((item) => this.withSignedMediaUrl(item))), total, page: query.page, limit: query.limit };
  }

  async sendMessage(userId: string, conversationId: string, dto: SendMessageDto, notify = true) {
    await this.ensureMember(userId, conversationId);
    this.validateMessage(conversationId, userId, dto);
    const conversation = await this.prisma.conversation.findUniqueOrThrow({ where: { id: conversationId }, select: { bookingId: true } });
    const now = new Date();
    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          type: dto.type,
          text: dto.type === 'TEXT' ? dto.text!.trim() : undefined,
          mediaUrl: undefined,
          mediaKey: dto.type === 'IMAGE' ? dto.mediaKey : undefined,
          latitude: dto.type === 'LOCATION' ? dto.latitude : undefined,
          longitude: dto.type === 'LOCATION' ? dto.longitude : undefined,
          address: dto.type === 'LOCATION' ? dto.address : undefined,
          // A booking message always belongs to the conversation's booking.
          // Never accept a booking id from the client.
          bookingId: conversation.bookingId,
        },
      });
      await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } });
      await tx.conversationMember.updateMany({ where: { conversationId }, data: { hiddenAt: null } });
      return created;
    });
    if (notify) this.notifyInBackground(userId, conversationId, message.id, dto, true);
    return this.withSignedMediaUrl(message);
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
    const [member, conversation] = await Promise.all([
      this.prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId } } }),
      this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { bookingId: true } }),
    ]);
    if (!member) throw new ForbiddenException('Ban khong thuoc cuoc tro chuyen nay');
    if (conversation?.bookingId) await this.bookingChatContext(userId, conversation.bookingId);
    return member;
  }

  private async ensureAccess(userId: string, conversationId: string) {
    const [member, user, conversation] = await Promise.all([
      this.prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId } } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
      this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { id: true, bookingId: true } }),
    ]);
    if (!conversation) throw new NotFoundException('Cuoc tro chuyen khong ton tai');
    if (!member && user?.role !== 'ADMIN') throw new ForbiddenException('Ban khong co quyen xem cuoc tro chuyen');
    if (member && conversation.bookingId) await this.bookingChatContext(userId, conversation.bookingId);
    return { member, isAdmin: user?.role === 'ADMIN' };
  }

  private validateMessage(conversationId: string, userId: string, dto: SendMessageDto) {
    if (!['TEXT', 'IMAGE', 'LOCATION'].includes(dto.type)) {
      throw new BadRequestException('Mobile khong duoc gui system message');
    }
    if (dto.type === 'TEXT' && !dto.text?.trim()) throw new BadRequestException('Noi dung tin nhan khong duoc de trong');
    if (dto.type === 'IMAGE' && !dto.mediaKey?.startsWith(`chat/${conversationId}/${userId}/`)) {
      throw new BadRequestException('Anh khong hop le hoac khong thuoc cuoc tro chuyen');
    }
    if (dto.type === 'LOCATION' && (dto.latitude === undefined || dto.longitude === undefined)) {
      throw new BadRequestException('Tin vi tri phai co latitude va longitude');
    }
  }

  private async withSignedMediaUrl<T extends { type: string; mediaKey: string | null }>(message: T) {
    if (message.type !== 'IMAGE' || !message.mediaKey) return message;
    return { ...message, mediaUrl: await this.storage.createReadUrl(message.mediaKey) };
  }

  private async bookingChatContext(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        customerId: true,
        assignmentMode: true,
        technicianId: true,
        technician: { select: { id: true, userId: true } },
        applications: { where: { status: 'SELECTED' }, select: { technicianProfileId: true } },
      },
    });
    if (!booking?.technician || !booking.technicianId) {
      throw new ForbiddenException('Chi co the chat sau khi don da duoc gan KTV');
    }
    const isCustomer = booking.customerId === userId;
    const isAssignedTechnician = booking.technician.userId === userId;
    if (!isCustomer && !isAssignedTechnician) {
      throw new ForbiddenException('Ban khong co quyen chat cho don nay');
    }
    if (booking.assignmentMode === 'OPEN_MARKETPLACE' && !booking.applications.some((item) => item.technicianProfileId === booking.technicianId)) {
      throw new ForbiddenException('KTV chua duoc chon cho don nay');
    }
    return booking;
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
    const [sender, recipients, conversation] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: senderId }, select: { displayName: true } }),
      this.recipientIds(senderId, conversationId),
      this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { bookingId: true } }),
    ]);
    const title = sender?.displayName ?? 'Ban co tin nhan moi';
    const body = dto.type === 'TEXT' ? dto.text!.trim().slice(0, 200) : dto.type === 'IMAGE' ? 'Da gui mot hinh anh' : 'Da gui vi tri';
    await Promise.all(recipients.map(async (recipientId) => {
      const actionUrl = conversation?.bookingId
        ? `matxa://chat/${conversationId}?bookingId=${conversation.bookingId}`
        : `matxa://chat/${conversationId}`;
      await this.notifications.create(recipientId, 'CHAT_MESSAGE_RECEIVED', title, body, actionUrl);
      if (push) await this.notifications.sendPush(recipientId, title, body, {
        type: 'CHAT_MESSAGE_RECEIVED', conversationId, messageId,
        ...(conversation?.bookingId ? { bookingId: conversation.bookingId } : {}),
      });
    }));
  }
}
