import { ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';

describe('admin chat', () => {
  function setup(role = 'ADMIN', member: object | null = { userId: 'admin' }) {
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue({ role }) },
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          customerId: 'customer',
          technicianId: 'tech-profile',
          technician: { userId: 'technician' },
        }),
      },
      conversation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'thread', bookingId: 'booking' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ bookingId: 'booking' }),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      conversationMember: { findUnique: jest.fn().mockResolvedValue(member), upsert: jest.fn(), updateMany: jest.fn() },
      message: {
        create: jest
          .fn()
          .mockResolvedValue({ id: 'message', senderId: 'admin', type: 'TEXT', text: 'Hello', mediaKey: null }),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
    };
    prisma.$transaction = jest.fn((callback) => callback(prisma));
    const service = new ChatService(prisma, {} as any, {} as any);
    return { prisma, service };
  }

  it.each([null, { userId: 'admin' }])(
    'allows an admin to reply whether or not membership exists (%j)',
    async (member) => {
      const { service, prisma } = setup('ADMIN', member);
      await expect(
        service.sendMessage('admin', 'thread', { type: 'TEXT', text: 'Hello' }, false),
      ).resolves.toMatchObject({ id: 'message', senderId: 'admin' });
      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ senderId: 'admin', bookingId: 'booking' }) }),
      );
      expect(prisma.booking.findUnique).not.toHaveBeenCalled();
    },
  );

  it('does not grant an unrelated customer the same access', async () => {
    const { service } = setup('CUSTOMER', null);
    await expect(
      service.sendMessage('outsider', 'thread', { type: 'TEXT', text: 'Hello' }, false),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an admin member to open the same booking chat via the socket gateway', async () => {
    const { service, prisma } = setup();
    await expect(service.ensureMember('admin', 'thread')).resolves.toMatchObject({ userId: 'admin' });
    expect(prisma.booking.findUnique).not.toHaveBeenCalled();
  });

  it('keeps booking assignment checks for regular members', async () => {
    const { service } = setup('TECHNICIAN', { userId: 'old-technician' });
    await expect(
      service.sendMessage('old-technician', 'thread', { type: 'TEXT', text: 'Hello' }, false),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('records an admin read cursor without marking messages read for customer/KTV', async () => {
    const { service, prisma } = setup('ADMIN', null);
    await service.markRead('admin', 'thread');
    expect(prisma.conversationMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { conversationId: 'thread', userId: 'admin', lastReadAt: expect.any(Date) },
      }),
    );
    expect(prisma.message.updateMany).not.toHaveBeenCalled();
  });

  it('counts unread messages using the admin cursor even if a participant already read them', async () => {
    const { service, prisma } = setup();
    prisma.conversation.findMany.mockResolvedValue([
      {
        id: 'thread',
        bookingId: 'booking',
        lastMessageAt: new Date(),
        messages: [],
        members: [
          { userId: 'technician', user: { id: 'technician', role: 'TECHNICIAN' } },
          { userId: 'customer', user: { id: 'customer', role: 'CUSTOMER' } },
          { userId: 'admin', lastReadAt: new Date('2026-10-29T10:00:00Z'), user: { role: 'ADMIN' } },
        ],
      },
    ]);
    prisma.message.findMany.mockResolvedValue([
      { conversationId: 'thread', createdAt: new Date('2026-10-29T09:00:00Z') },
      { conversationId: 'thread', createdAt: new Date('2026-10-29T11:00:00Z') },
    ]);
    const result = await service.listConversations('admin');
    expect(result[0]).toMatchObject({ unreadCount: 1, participant: { id: 'customer' } });
  });

  it.each([
    [[{ user: { id: 'admin', role: 'ADMIN' } }, { user: { id: 'technician', role: 'TECHNICIAN' } }], 'technician'],
    [[{ user: { id: 'admin', role: 'ADMIN' } }], 'admin'],
  ])(
    'keeps the original chat counterpart when admins join or a legacy thread only has admin (%j)',
    async (members, participantId) => {
      const { service, prisma } = setup('CUSTOMER');
      prisma.conversationMember.findMany = jest.fn().mockResolvedValue([
        {
          lastReadAt: null,
          conversation: { id: 'thread', members, messages: [] },
        },
      ]);
      prisma.message.findMany.mockResolvedValue([]);
      jest.spyOn(service, 'ensureMember').mockResolvedValue({} as any);
      const result = await service.listConversations('customer');
      expect(result[0]).toMatchObject({ participant: { id: participantId } });
    },
  );
});
