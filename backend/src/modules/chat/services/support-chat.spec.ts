import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';

describe('support conversations', () => {
  const thread = { id: 'support-1', type: 'SUPPORT', supportCustomerId: 'customer', customerId: 'customer', bookingId: null };
  function setup(role = 'ADMIN', member: any = null, actorId = 'admin') {
    const prisma: any = {
      user: {
        findUnique: jest.fn(({ where }) => Promise.resolve(where.id === actorId
          ? { id: actorId, role, status: 'ACTIVE', displayName: 'Actor' }
          : { id: where.id, role: 'CUSTOMER', status: 'ACTIVE', displayName: 'Customer' })),
        findMany: jest.fn().mockResolvedValue([{ id: 'admin' }, { id: 'admin-2' }]),
      },
      conversation: {
        upsert: jest.fn().mockResolvedValue(thread), findUnique: jest.fn().mockResolvedValue(thread),
        findUniqueOrThrow: jest.fn().mockResolvedValue(thread), update: jest.fn(), findMany: jest.fn().mockResolvedValue([]),
      },
      conversationMember: { upsert: jest.fn().mockResolvedValue({ userId: actorId }), findUnique: jest.fn().mockResolvedValue(member), updateMany: jest.fn(), update: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      message: { create: jest.fn().mockResolvedValue({ id: 'message', conversationId: thread.id, senderId: actorId, type: 'TEXT', text: 'Hello', mediaKey: null }), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), updateMany: jest.fn() },
      booking: { findUnique: jest.fn() },
    };
    prisma.$transaction = jest.fn((arg) => typeof arg === 'function' ? arg(prisma) : Promise.all(arg));
    const notifications = { create: jest.fn().mockResolvedValue({}), sendPush: jest.fn().mockResolvedValue({}) };
    const service = new ChatService(prisma, notifications as any, {} as any);
    return { prisma, service, notifications };
  }

  it('opens one persistent customer support thread for different admins without a booking', async () => {
    const { prisma, service } = setup();
    const first = await service.createSupportConversation('admin', 'customer');
    const second = await service.createSupportConversation('admin', 'customer');
    expect(first.id).toBe(second.id);
    expect(first).toMatchObject({ type: 'SUPPORT', bookingId: null, participant: { id: 'customer' } });
    expect(prisma.conversation.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { supportCustomerId: 'customer' }, update: {},
      create: expect.objectContaining({ type: 'SUPPORT', customerId: 'customer', supportCustomerId: 'customer' }),
    }));
    expect(prisma.conversationMember.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { conversationId: thread.id, userId: 'customer' }, update: { hiddenAt: null },
    }));
    expect(prisma.message.create).not.toHaveBeenCalled();
    expect(prisma.booking.findUnique).not.toHaveBeenCalled();
  });

  it('rejects non-admin creation and non-customer targets', async () => {
    const { service, prisma } = setup('CUSTOMER');
    await expect(service.createSupportConversation('admin', 'customer')).rejects.toBeInstanceOf(ForbiddenException);
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' });
    await expect(service.createSupportConversation('admin', 'other-admin')).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['customer', 'admin', 'admin-2'])('allows the customer and CSKH to send (%s)', async (actor) => {
    const { service, prisma } = setup(actor === 'customer' ? 'CUSTOMER' : 'ADMIN', actor === 'customer' ? { userId: actor } : null, actor);
    await expect(service.sendMessage(actor, thread.id, { type: 'TEXT', text: 'Hello' }, false)).resolves.toMatchObject({ id: 'message' });
    expect(prisma.message.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ senderId: actor, bookingId: null }) }));
    expect(prisma.booking.findUnique).not.toHaveBeenCalled();
  });

  it('rejects another customer and a technician even if an invalid membership exists', async () => {
    for (const role of ['CUSTOMER', 'TECHNICIAN']) {
      const { service } = setup(role, { userId: 'outsider' }, 'outsider');
      await expect(service.sendMessage('outsider', thread.id, { type: 'TEXT', text: 'Hi' }, false)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.ensureMember('outsider', thread.id)).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it('lets another admin join for sockets and image uploads', async () => {
    const { service, prisma } = setup('ADMIN', null, 'admin-2');
    await service.ensureMember('admin-2', thread.id);
    expect(prisma.conversationMember.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { conversationId: thread.id, userId: 'admin-2' } }));
  });

  it('keeps full support history after a customer hides and reopens it', async () => {
    const { service, prisma } = setup('CUSTOMER', { hiddenAt: new Date() }, 'customer');
    await service.listMessages('customer', thread.id, { page: 1, limit: 30 });
    expect(prisma.message.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { conversationId: thread.id } }));
  });

  it('routes customer replies to all active admins, admin replies only to the customer', async () => {
    const { service, prisma } = setup();
    expect(await service.recipientIds('customer', thread.id)).toEqual(['admin', 'admin-2']);
    expect(prisma.user.findMany).toHaveBeenCalledWith({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
    expect(await service.recipientIds('admin-2', thread.id)).toEqual(['customer']);
  });

  it('sends support push metadata with the customer conversation id', async () => {
    const { service, notifications } = setup();
    await (service as any).notifyRecipients('admin', thread.id, 'message', { type: 'TEXT', text: 'Hello' }, true);
    expect(notifications.create).toHaveBeenCalledWith('customer', 'CHAT_MESSAGE_RECEIVED', 'MATXXA CSKH', 'Hello', `matxa://chat/${thread.id}`);
    expect(notifications.sendPush).toHaveBeenCalledWith('customer', 'MATXXA CSKH', 'Hello', expect.objectContaining({ conversationId: thread.id, conversationType: 'SUPPORT' }));
  });

  it('filters the admin inbox to support threads', async () => {
    const { service, prisma } = setup();
    await service.listConversations('admin', 'SUPPORT');
    expect(prisma.conversation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { type: 'SUPPORT' } }));
  });
});
