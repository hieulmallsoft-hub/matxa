import { SupportChatRetentionService } from './support-chat-retention.service';

describe('SupportChatRetentionService', () => {
  function setup(days?: number) {
    const prisma: any = { conversation: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) } };
    const config: any = { get: (key: string, fallback: unknown) => (key === 'SUPPORT_CHAT_RETENTION_DAYS' && days !== undefined ? days : fallback) };
    return { prisma, service: new SupportChatRetentionService(prisma, config) };
  }

  it('deletes only support threads inactive for longer than 90 days by default', async () => {
    const { service, prisma } = setup();
    const now = new Date('2026-11-02T00:00:00.000Z');
    await expect(service.run(now)).resolves.toBe(2);
    const cutoff = new Date('2026-08-04T00:00:00.000Z');
    expect(prisma.conversation.deleteMany).toHaveBeenCalledWith({
      where: { type: 'SUPPORT', OR: [{ lastMessageAt: { lt: cutoff } }, { lastMessageAt: null, createdAt: { lt: cutoff } }] },
    });
  });

  it('keeps history forever when retention is 0', async () => {
    const { service, prisma } = setup(0);
    await expect(service.run()).resolves.toBe(0);
    expect(prisma.conversation.deleteMany).not.toHaveBeenCalled();
  });
});
