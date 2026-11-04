import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { ChatStorageService } from './chat-storage.service';
import { CreateConversationDto, EditMessageDto, ListMessagesDto, SendMessageDto } from '../dto/chat.dto';
import { COMPLAINT_CREATED, COMPLAINT_STATUS_LABEL } from '../../bookings/services/complaint-conversation';

const EDIT_WINDOW_MS = 15 * 60 * 1000;
const SUPPORT_PARTICIPANT = { id: 'support', displayName: 'MATXXA CSKH', avatarUrl: null, role: 'ADMIN' };
// Support SYSTEM messages store a stable event code in `text`; responses expose it as
// `systemEvent` and replace `text` with the display copy.
const SUPPORT_WELCOME = 'SUPPORT_WELCOME';
const SUPPORT_AGENT_JOINED = 'SUPPORT_AGENT_JOINED';
/** Customer <-> admin threads: the general CSKH one and the per-complaint one. */
const ADMIN_THREAD_TYPES = ['SUPPORT', 'COMPLAINT'];
/** The customer a CSKH or complaint thread belongs to. */
const threadOwner = (conversation: { type?: string | null; supportCustomerId?: string | null; customerId?: string | null } | null) =>
  conversation?.type === 'SUPPORT' ? conversation.supportCustomerId : conversation?.type === 'COMPLAINT' ? conversation.customerId : null;
const COMPLAINT_SUMMARY_SELECT = { id: true, bookingId: true, status: true, reasonCode: true } as const;
const complaintSummary = (complaint: { id: string; bookingId: string; status: string; reasonCode: string } | null | undefined) =>
  complaint
    ? {
        ...complaint,
        bookingCode: complaint.bookingId.slice(0, 8).toUpperCase(),
        statusLabel: COMPLAINT_STATUS_LABEL[complaint.status] ?? complaint.status,
      }
    : null;
/** A booking chat stays readable after these, but takes no new messages. */
const CLOSED_BOOKING_STATUSES = ['CANCELLED', 'EXPIRED'];
const SUPPORT_SYSTEM_TEXT: Record<string, string> = {
  [SUPPORT_WELCOME]: 'MATXXA CSKH có thể giúp gì cho bạn?',
  [SUPPORT_AGENT_JOINED]: 'MATXXA CSKH đã tham gia cuộc trò chuyện',
};

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

  /** An admin opens the thread of a chosen customer; a customer opens their own. */
  async createSupportConversation(actorId: string, requestedCustomerId?: string) {
    const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { role: true, status: true } });
    if (actor?.status !== 'ACTIVE' || !['ADMIN', 'CUSTOMER'].includes(actor.role))
      throw new ForbiddenException('Chi admin hoac khach hang duoc mo hoi thoai ho tro');
    const isAdmin = actor.role === 'ADMIN';
    // A customer can only open their own thread, whatever customerId the body carries.
    const customerId = isAdmin ? requestedCustomerId : actorId;
    if (!customerId) throw new BadRequestException('Vui long chon khach hang');
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId }, select: { id: true, role: true, status: true, displayName: true, avatarUrl: true },
    });
    if (!customer || customer.role !== 'CUSTOMER' || customer.status !== 'ACTIVE')
      throw new BadRequestException('Vui long chon khach hang dang hoat dong');
    const conversation = await this.prisma.$transaction(async (tx) => {
      // A unique customer key makes reopening and concurrent creation idempotent.
      const thread = await tx.conversation.upsert({
        where: { supportCustomerId: customerId },
        update: {},
        create: { type: 'SUPPORT', supportCustomerId: customerId, customerId,
          participantKey: `support:${customerId}`, lastMessageAt: new Date(),
          messages: { create: { senderId: customerId, type: 'SYSTEM', text: SUPPORT_WELCOME } } },
      });
      for (const userId of isAdmin ? [customerId, actorId] : [customerId]) {
        await tx.conversationMember.upsert({
          where: { conversationId_userId: { conversationId: thread.id, userId } },
          create: { conversationId: thread.id, userId }, update: { hiddenAt: null },
        });
      }
      return thread;
    });
    return { id: conversation.id, type: conversation.type, supportCustomerId: customerId,
      bookingId: null,
      participant: isAdmin
        ? { id: customer.id, displayName: customer.displayName, avatarUrl: customer.avatarUrl }
        : SUPPORT_PARTICIPANT,
      lastMessageAt: conversation.lastMessageAt };
  }

  /** First line of a "Nhắn để đặt" request, so CSKH knows which venue the customer means. */
  async venueInquiryText(venueId: string) {
    const venue = await this.prisma.venue.findFirst({
      where: { id: venueId, isActive: true, deletedAt: null },
      select: { name: true, address: true },
    });
    if (!venue) throw new NotFoundException('Khong tim thay dia diem');
    return `Mình muốn đặt lịch tại ${venue.name} (${venue.address}).`;
  }

  /** Opens the only permitted chat for a booking. Participants are always
   * derived from Booking; the client never supplies a technician/customer id. */
  async createBookingConversation(userId: string, bookingId: string) {
    const booking = await this.bookingChatContext(userId, bookingId);
    const technicianUserId = booking.technician!.userId;
    const participantKey = [booking.customerId, technicianUserId].sort().join(':');
    const selectionTemplate = await this.getNotificationTemplate('TECHNICIAN_SELECTED');
    const selectionText =
      selectionTemplate?.isActive === false
        ? 'TECHNICIAN_SELECTED'
        : selectionTemplate?.body || 'Khách hàng đã chọn KTV cho đơn dịch vụ.';
    let conversation;
    try {
      conversation = await this.prisma.conversation.upsert({
        where: { bookingId },
        update: {},
        create: {
          bookingId,
          type: 'BOOKING',
          customerId: booking.customerId,
          technicianUserId,
          participantKey,
          lastMessageAt: new Date(),
          members: { create: [{ userId: booking.customerId }, { userId: technicianUserId }] },
          messages: {
            create: {
              senderId: booking.customerId,
              type: 'SYSTEM',
              text: selectionText,
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
    await this.prisma.conversationMember.updateMany({
      where: { conversationId: conversation.id },
      data: { hiddenAt: null },
    });
    return conversation;
  }

  async listConversations(userId: string, type?: 'BOOKING' | 'SUPPORT' | 'COMPLAINT' | 'LEGACY') {
    const currentUser = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (currentUser?.role === 'ADMIN') {
      const conversations = await this.prisma.conversation.findMany({
        where: type ? { type } : undefined,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          members: { include: { user: { select: { id: true, displayName: true, avatarUrl: true, role: true } } } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          complaint: { select: COMPLAINT_SUMMARY_SELECT },
        },
      });
      const ids = conversations.map((conversation) => conversation.id);
      const unread = ids.length
        ? await this.prisma.message.findMany({
            where: { conversationId: { in: ids }, senderId: { not: userId }, recalledAt: null },
            select: { conversationId: true, createdAt: true },
          })
        : [];
      const unreadByConversation = new Map<string, number>();
      const lastReadByConversation = new Map(
        conversations.map((conversation) => [
          conversation.id,
          conversation.members.find((member) => member.userId === userId)?.lastReadAt,
        ]),
      );
      for (const message of unread) {
        const lastReadAt = lastReadByConversation.get(message.conversationId);
        if (!lastReadAt || message.createdAt > lastReadAt)
          unreadByConversation.set(message.conversationId, (unreadByConversation.get(message.conversationId) ?? 0) + 1);
      }
      return conversations.map((conversation) => {
        const participant =
          conversation.members.find((member) => member.user.role === 'CUSTOMER')?.user ??
          conversation.members.find((member) => member.user.role !== 'ADMIN')?.user;
        return {
          id: conversation.id,
          type: conversation.type ?? (conversation.bookingId ? 'BOOKING' : 'LEGACY'),
          supportCustomerId: conversation.supportCustomerId ?? null,
          bookingId: conversation.bookingId,
          participant,
          complaint: complaintSummary(conversation.complaint),
          lastMessage: conversation.messages[0] ? this.withSupportSystemText(conversation.messages[0]) : null,
          lastMessageAt: conversation.lastMessageAt,
          unreadCount: unreadByConversation.get(conversation.id) ?? 0,
        };
      });
    }
    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId, hiddenAt: null, ...(type ? { conversation: { type } } : {}) },
      orderBy: { conversation: { lastMessageAt: 'desc' } },
      include: {
        conversation: {
          include: {
            members: {
              where: { userId: { not: userId } },
              include: { user: { select: { id: true, displayName: true, avatarUrl: true, role: true } } },
            },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
            booking: { select: { status: true } },
            complaint: { select: COMPLAINT_SUMMARY_SELECT },
          },
        },
      },
    });
    const conversationIds = memberships.map(({ conversation }) => conversation.id);
    const unreadMessages =
      conversationIds.length === 0
        ? []
        : await this.prisma.message.findMany({
            where: { conversationId: { in: conversationIds }, senderId: { not: userId }, recalledAt: null },
            select: { conversationId: true, createdAt: true },
          });
    const unreadByConversation = new Map<string, number>();
    for (const membership of memberships) {
      const count = unreadMessages.filter(
        (message) =>
          message.conversationId === membership.conversation.id &&
          (!membership.lastReadAt || message.createdAt > membership.lastReadAt),
      ).length;
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
          type: conversation.type ?? (conversation.bookingId ? 'BOOKING' : 'LEGACY'),
          supportCustomerId: conversation.supportCustomerId ?? null,
          bookingId: conversation.bookingId,
          participant: ADMIN_THREAD_TYPES.includes(conversation.type)
            ? SUPPORT_PARTICIPANT
            : conversation.members.find((member) => member.user.role !== 'ADMIN')?.user ?? conversation.members[0]?.user,
          lastMessage: conversation.messages[0] ? this.withSupportSystemText(conversation.messages[0]) : null,
          lastMessageAt: conversation.lastMessageAt,
          unreadCount: unreadByConversation.get(conversation.id) ?? 0,
          bookingStatus: conversation.booking?.status ?? null,
          // "Khiếu nại đơn #XXXX" threads carry the complaint they are about.
          complaint: complaintSummary(conversation.complaint),
          // false once the booking is cancelled/expired: show the history, hide the message box.
          canSendMessage: !conversation.booking || !CLOSED_BOOKING_STATUSES.includes(conversation.booking.status),
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
      ...(access.member?.hiddenAt && access.conversation.type !== 'SUPPORT' ? { createdAt: { gt: access.member.hiddenAt } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where,
        include: { sender: { select: { id: true, displayName: true, avatarUrl: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.message.count({ where }),
    ]);
    return {
      items: await Promise.all(
        items.map(async (item) => this.withSignedMediaUrl(await this.withSystemMessageText(item))),
      ),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  /** Membership plus: a booking chat only takes new messages while the booking is still on. */
  async ensureCanWrite(userId: string, conversationId: string) {
    const access = await this.ensureAccess(userId, conversationId);
    if (access.bookingStatus && CLOSED_BOOKING_STATUSES.includes(access.bookingStatus))
      throw new ForbiddenException('Don da ket thuc, cuoc tro chuyen chi con xem lai');
    return access;
  }

  async sendMessage(userId: string, conversationId: string, dto: SendMessageDto, notify = true) {
    const { isAdmin } = await this.ensureCanWrite(userId, conversationId);
    this.validateMessage(conversationId, userId, dto);
    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: { bookingId: true, type: true },
    });
    const now = new Date();
    let joinMessage: Awaited<ReturnType<typeof this.prisma.message.create>> | undefined;
    const message = await this.prisma.$transaction(async (tx) => {
      // The first admin reply in a support thread is preceded by a "CSKH joined" event.
      if (ADMIN_THREAD_TYPES.includes(conversation.type) && isAdmin) {
        const joined = await tx.message.findFirst({
          where: { conversationId, type: 'SYSTEM', text: SUPPORT_AGENT_JOINED },
          select: { id: true },
        });
        if (!joined)
          joinMessage = await tx.message.create({
            include: { sender: { select: { id: true, displayName: true, avatarUrl: true, role: true } } },
            // PostgreSQL now() is fixed per transaction, so order the pair explicitly.
            data: { conversationId, senderId: userId, type: 'SYSTEM', text: SUPPORT_AGENT_JOINED,
              createdAt: new Date(now.getTime() - 1) },
          });
      }
      const created = await tx.message.create({
        include: { sender: { select: { id: true, displayName: true, avatarUrl: true, role: true } } },
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
          createdAt: now,
        },
      });
      await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } });
      await tx.conversationMember.updateMany({ where: { conversationId }, data: { hiddenAt: null } });
      return created;
    });
    if (notify) this.notifyInBackground(userId, conversationId, message.id, dto, true);
    const sent = await this.withSignedMediaUrl(message);
    // Callers publish joinMessage over the socket before the reply itself.
    return joinMessage ? { ...sent, joinMessage: this.withSupportSystemText(joinMessage) } : sent;
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
      data: {
        recalledAt: new Date(),
        text: null,
        mediaUrl: null,
        mediaKey: null,
        latitude: null,
        longitude: null,
        address: null,
      },
    });
  }

  async markRead(userId: string, conversationId: string) {
    const access = await this.ensureAccess(userId, conversationId);
    const now = new Date();
    // Admin reads have their own cursor; they must not mark customer/KTV
    // messages read on behalf of either participant.
    if (access.isAdmin) {
      await this.prisma.conversationMember.upsert({
        where: { conversationId_userId: { conversationId, userId } },
        create: { conversationId, userId, lastReadAt: now },
        update: { lastReadAt: now, hiddenAt: null },
      });
      return { updated: 0, readAt: now };
    }
    const result = await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: now, deliveredAt: now },
    });
    if (access.member) {
      await this.prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadAt: now },
      });
    }
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
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId }, select: { type: true, supportCustomerId: true, customerId: true },
    });
    if (conversation && ADMIN_THREAD_TYPES.includes(conversation.type)) {
      const owner = threadOwner(conversation);
      if (userId !== owner) return owner ? [owner] : [];
      const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
      return admins.map((admin) => admin.id);
    }
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId, userId: { not: userId } },
      select: { userId: true },
    });
    return members.map((member) => member.userId);
  }

  async ensureMember(userId: string, conversationId: string) {
    const [member, conversation] = await Promise.all([
      this.prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId } } }),
      this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { bookingId: true, type: true, supportCustomerId: true, customerId: true } }),
    ]);
    if (conversation && ADMIN_THREAD_TYPES.includes(conversation.type)) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (user?.role === 'ADMIN') {
        return this.prisma.conversationMember.upsert({
          where: { conversationId_userId: { conversationId, userId } },
          create: { conversationId, userId }, update: {},
        });
      }
      if (threadOwner(conversation) !== userId) throw new ForbiddenException('Ban khong thuoc hoi thoai ho tro nay');
    }
    if (!member) throw new ForbiddenException('Ban khong thuoc cuoc tro chuyen nay');
    if (conversation?.bookingId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (user?.role !== 'ADMIN') await this.bookingChatContext(userId, conversation.bookingId);
    }
    return member;
  }

  private async ensureAccess(userId: string, conversationId: string) {
    const [member, user, conversation] = await Promise.all([
      this.prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId } } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
      this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { id: true, bookingId: true, type: true, supportCustomerId: true, customerId: true } }),
    ]);
    if (!conversation) throw new NotFoundException('Cuoc tro chuyen khong ton tai');
    if (!member && user?.role !== 'ADMIN') throw new ForbiddenException('Ban khong co quyen xem cuoc tro chuyen');
    if (ADMIN_THREAD_TYPES.includes(conversation.type) && user?.role !== 'ADMIN' && threadOwner(conversation) !== userId)
      throw new ForbiddenException('Ban khong thuoc hoi thoai ho tro nay');
    const booking =
      member && user?.role !== 'ADMIN' && conversation.bookingId
        ? await this.bookingChatContext(userId, conversation.bookingId)
        : null;
    return { member, isAdmin: user?.role === 'ADMIN', conversation, bookingStatus: booking?.status ?? null };
  }

  private validateMessage(conversationId: string, userId: string, dto: SendMessageDto) {
    if (!['TEXT', 'IMAGE', 'LOCATION'].includes(dto.type)) {
      throw new BadRequestException('Mobile khong duoc gui system message');
    }
    if (dto.type === 'TEXT' && !dto.text?.trim())
      throw new BadRequestException('Noi dung tin nhan khong duoc de trong');
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

  private withSupportSystemText<T extends { type: string; text: string | null }>(message: T) {
    if (message.type !== 'SYSTEM' || !message.text || !(message.text in SUPPORT_SYSTEM_TEXT)) return message;
    return { ...message, systemEvent: message.text, text: SUPPORT_SYSTEM_TEXT[message.text] };
  }

  private async withSystemMessageText<T extends { type: string; text: string | null }>(message: T) {
    if (message.type === 'SYSTEM' && message.text === COMPLAINT_CREATED)
      return { ...message, systemEvent: COMPLAINT_CREATED, text: 'Bạn đã gửi khiếu nại. CSKH sẽ phản hồi tại đây.' };
    if (message.type === 'SYSTEM' && message.text?.startsWith('COMPLAINT_STATUS:')) {
      const complaintStatus = message.text.slice('COMPLAINT_STATUS:'.length);
      return {
        ...message,
        systemEvent: 'COMPLAINT_STATUS_CHANGED',
        complaintStatus,
        text: `Khiếu nại đã chuyển sang: ${COMPLAINT_STATUS_LABEL[complaintStatus] ?? complaintStatus}`,
      };
    }
    if (message.type === 'SYSTEM' && message.text && message.text in SUPPORT_SYSTEM_TEXT)
      return this.withSupportSystemText(message);
    if (message.type !== 'SYSTEM' || message.text !== 'TECHNICIAN_SELECTED') return message;
    const template = await this.getNotificationTemplate('TECHNICIAN_SELECTED');
    if (template?.isActive === false) return message;
    return { ...message, text: template?.body || 'Khách hàng đã chọn KTV cho đơn dịch vụ.' };
  }

  private async getNotificationTemplate(type: string) {
    // Keep chat creation compatible with lightweight service mocks and older
    // deployments while the notification template API is being rolled out.
    const getter = (
      this.notifications as NotificationsService & {
        getTemplate?: (templateType: string) => Promise<{ body?: string; isActive?: boolean } | null>;
      }
    ).getTemplate;
    return typeof getter === 'function' ? getter.call(this.notifications, type) : null;
  }

  private async bookingChatContext(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        customerId: true,
        assignmentMode: true,
        status: true,
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
    if (
      booking.assignmentMode === 'OPEN_MARKETPLACE' &&
      !booking.applications.some((item) => item.technicianProfileId === booking.technicianId)
    ) {
      throw new ForbiddenException('KTV chua duoc chon cho don nay');
    }
    return booking;
  }

  private async ownEditableMessage(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Tin nhan khong ton tai');
    if (message.senderId !== userId) throw new ForbiddenException('Chi nguoi gui moi co the thay doi tin nhan');
    if (message.recalledAt) throw new BadRequestException('Tin nhan da duoc thu hoi');
    if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS)
      throw new BadRequestException('Da qua 15 phut de sua hoac thu hoi');
    return message;
  }

  notifyInBackground(senderId: string, conversationId: string, messageId: string, dto: SendMessageDto, push: boolean) {
    void this.notifyRecipients(senderId, conversationId, messageId, dto, push).catch((error: unknown) => {
      this.logger.warn(
        `Khong the tao thong bao cho tin nhan ${messageId}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    });
  }

  private async notifyRecipients(
    senderId: string,
    conversationId: string,
    messageId: string,
    dto: SendMessageDto,
    push: boolean,
  ) {
    const [sender, recipients, conversation] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: senderId }, select: { displayName: true } }),
      this.recipientIds(senderId, conversationId),
      this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { bookingId: true, type: true, supportCustomerId: true, customerId: true } }),
    ]);
    const title = conversation && ADMIN_THREAD_TYPES.includes(conversation.type) && senderId !== threadOwner(conversation)
      ? 'MATXXA CSKH' : sender?.displayName ?? 'Bạn có tin nhắn mới';
    const body =
      dto.type === 'TEXT'
        ? dto.text!.trim().slice(0, 200)
        : dto.type === 'IMAGE'
          ? 'Đã gửi một hình ảnh'
          : 'Đã gửi vị trí';
    await Promise.all(
      recipients.map(async (recipientId) => {
        const actionUrl = conversation?.bookingId
          ? `matxa://chat/${conversationId}?bookingId=${conversation.bookingId}`
          : `matxa://chat/${conversationId}`;
        await this.notifications.create(recipientId, 'CHAT_MESSAGE_RECEIVED', title, body, actionUrl);
        if (push)
          await this.notifications.sendPush(recipientId, title, body, {
            type: 'CHAT_MESSAGE_RECEIVED',
            conversationId,
            messageId,
            ...(conversation?.type ? { conversationType: conversation.type } : {}),
            ...(conversation?.bookingId ? { bookingId: conversation.bookingId } : {}),
          });
      }),
    );
  }
}
