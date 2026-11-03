import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SupportChatRetentionService } from './support-chat-retention.service';

describe('SupportChatRetentionService', () => {
  function setup(hours?: number) {
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' }) },
      conversation: {
        findUnique: jest.fn().mockResolvedValue({ type: 'SUPPORT' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'idle-1' }, { id: 'idle-2' }]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      conversationMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'customer' }, { userId: 'admin' }]) },
      message: { findMany: jest.fn().mockResolvedValue([{ mediaKey: 'chat/c1/customer/a.jpg' }]) },
      notification: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const config: any = { get: (key: string, fallback: unknown) => (key === 'SUPPORT_CHAT_IDLE_HOURS' && hours !== undefined ? hours : fallback) };
    const storage = { deleteObjects: jest.fn() };
    const gateway = { publishConversationEnded: jest.fn() };
    return { prisma, storage, gateway, service: new SupportChatRetentionService(prisma, config, storage as any, gateway as any) };
  }

  it('deletes the thread, its images and quoting notifications when an admin ends it, then tells both sides', async () => {
    const { service, prisma, storage, gateway } = setup();
    await expect(service.endByAdmin('admin', 'c1')).resolves.toEqual({ conversationId: 'c1', ended: true });
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { actionUrl: 'matxa://chat/c1' } });
    expect(prisma.conversation.deleteMany).toHaveBeenCalledWith({ where: { id: 'c1', type: 'SUPPORT' } });
    expect(storage.deleteObjects).toHaveBeenCalledWith(['chat/c1/customer/a.jpg']);
    expect(gateway.publishConversationEnded).toHaveBeenCalledWith('c1', ['customer', 'admin'], 'AGENT_ENDED');
  });

  it('only lets an admin end a support chat', async () => {
    const customer = setup();
    customer.prisma.user.findUnique.mockResolvedValue({ role: 'CUSTOMER', status: 'ACTIVE' });
    await expect(customer.service.endByAdmin('customer', 'c1')).rejects.toBeInstanceOf(ForbiddenException);
    const booking = setup();
    booking.prisma.conversation.findUnique.mockResolvedValue({ type: 'BOOKING' });
    await expect(booking.service.endByAdmin('admin', 'c1')).rejects.toBeInstanceOf(BadRequestException);
    expect(booking.prisma.conversation.deleteMany).not.toHaveBeenCalled();
  });

  it('ends support threads idle for longer than 24 hours by default', async () => {
    const { service, prisma, gateway } = setup();
    const now = new Date('2026-11-03T12:00:00.000Z');
    await expect(service.run(now)).resolves.toBe(2);
    const cutoff = new Date('2026-11-02T12:00:00.000Z');
    expect(prisma.conversation.findMany).toHaveBeenCalledWith({
      where: { type: 'SUPPORT', OR: [{ lastMessageAt: { lt: cutoff } }, { lastMessageAt: null, createdAt: { lt: cutoff } }] },
      select: { id: true },
    });
    expect(gateway.publishConversationEnded).toHaveBeenCalledWith('idle-1', expect.any(Array), 'IDLE');
  });

  it('does not announce a thread another instance already deleted', async () => {
    const { service, prisma, gateway, storage } = setup();
    prisma.conversation.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.run()).resolves.toBe(0);
    expect(gateway.publishConversationEnded).not.toHaveBeenCalled();
    expect(storage.deleteObjects).not.toHaveBeenCalled();
  });

  it('never ends chats automatically when the idle limit is 0', async () => {
    const { service, prisma } = setup(0);
    await expect(service.run()).resolves.toBe(0);
    expect(prisma.conversation.findMany).not.toHaveBeenCalled();
  });
});
