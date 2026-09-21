import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  const conversationMember = {
    findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn(),
  };
  const conversation = {
    upsert: jest.fn(), update: jest.fn(), findUnique: jest.fn(),
  };
  const message = {
    create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findMany: jest.fn(), count: jest.fn(),
  };
  const user = { findFirst: jest.fn(), findUnique: jest.fn() };
  const prisma = { conversationMember, conversation, message, user, $transaction: jest.fn() };
  const notifications = { create: jest.fn(), sendPush: jest.fn() };
  const service = new ChatService(prisma as never, notifications as never);

  beforeEach(() => jest.clearAllMocks());

  it('does not create a conversation with the same user', async () => {
    await expect(service.createConversation('user-1', { participantId: 'user-1' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an empty text message', async () => {
    conversationMember.findUnique.mockResolvedValue({ userId: 'user-1' });
    await expect(service.sendMessage('user-1', 'conversation-1', { type: 'TEXT', text: '   ' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not let another user edit a message', async () => {
    message.findUnique.mockResolvedValue({ senderId: 'user-2', createdAt: new Date(), recalledAt: null, type: 'TEXT' });
    await expect(service.editMessage('user-1', 'message-1', { text: 'new text' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not edit a message after 15 minutes', async () => {
    message.findUnique.mockResolvedValue({
      senderId: 'user-1', createdAt: new Date(Date.now() - 16 * 60 * 1000), recalledAt: null, type: 'TEXT',
    });
    await expect(service.editMessage('user-1', 'message-1', { text: 'new text' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('hides a conversation only for the current member', async () => {
    conversationMember.findUnique.mockResolvedValue({ userId: 'user-1' });
    conversationMember.update.mockResolvedValue({});
    await service.hideConversation('user-1', 'conversation-1');
    expect(conversationMember.update).toHaveBeenCalledWith({
      where: { conversationId_userId: { conversationId: 'conversation-1', userId: 'user-1' } },
      data: { hiddenAt: expect.any(Date) },
    });
  });
});
