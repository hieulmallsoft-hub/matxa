import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  const conversationMember = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  const conversation = {
    upsert: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  };
  const booking = { findUnique: jest.fn() };
  const message = {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  };
  const user = { findFirst: jest.fn(), findUnique: jest.fn() };
  const prisma = { conversationMember, conversation, message, user, booking, $transaction: jest.fn() };
  const notifications = { create: jest.fn(), sendPush: jest.fn() };
  const storage = { createReadUrl: jest.fn() };
  const service = new ChatService(prisma as never, notifications as never, storage as never);

  beforeEach(() => jest.clearAllMocks());

  it('does not create a conversation with the same user', async () => {
    await expect(service.createConversation('user-1', { participantId: 'user-1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('creates a booking-specific chat for a DIRECT assigned technician', async () => {
    booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      customerId: 'customer-1',
      assignmentMode: 'DIRECT',
      technicianId: 'profile-1',
      technician: { id: 'profile-1', userId: 'technician-1' },
      applications: [],
    });
    conversation.upsert.mockResolvedValue({ id: 'conversation-1', bookingId: 'booking-1', members: [] });

    await service.createBookingConversation('technician-1', 'booking-1');

    expect(conversation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: 'booking-1' },
        create: expect.objectContaining({
          bookingId: 'booking-1',
          customerId: 'customer-1',
          technicianUserId: 'technician-1',
        }),
      }),
    );
  });

  it('rejects an OPEN applicant who was not selected', async () => {
    booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      customerId: 'customer-1',
      assignmentMode: 'OPEN_MARKETPLACE',
      technicianId: 'selected-profile',
      technician: { id: 'selected-profile', userId: 'selected-user' },
      applications: [],
    });

    await expect(service.createBookingConversation('selected-user', 'booking-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows the SELECTED technician and customer to open an OPEN booking chat', async () => {
    const selectedBooking = {
      id: 'booking-open',
      customerId: 'customer-1',
      assignmentMode: 'OPEN_MARKETPLACE',
      technicianId: 'selected-profile',
      technician: { id: 'selected-profile', userId: 'selected-user' },
      applications: [{ technicianProfileId: 'selected-profile' }],
    };
    booking.findUnique.mockResolvedValue(selectedBooking);
    conversation.upsert.mockResolvedValue({ id: 'conversation-open', bookingId: 'booking-open', members: [] });

    await expect(service.createBookingConversation('selected-user', 'booking-open')).resolves.toMatchObject({
      id: 'conversation-open',
    });
    await expect(service.createBookingConversation('customer-1', 'booking-open')).resolves.toMatchObject({
      id: 'conversation-open',
    });
  });

  it('uses the booking id as the conversation identity even for the same pair', async () => {
    booking.findUnique
      .mockResolvedValueOnce({
        id: 'booking-1',
        customerId: 'customer-1',
        assignmentMode: 'DIRECT',
        technicianId: 'profile-1',
        technician: { id: 'profile-1', userId: 'technician-1' },
        applications: [],
      })
      .mockResolvedValueOnce({
        id: 'booking-2',
        customerId: 'customer-1',
        assignmentMode: 'DIRECT',
        technicianId: 'profile-1',
        technician: { id: 'profile-1', userId: 'technician-1' },
        applications: [],
      });
    conversation.upsert
      .mockResolvedValueOnce({ id: 'conversation-1', bookingId: 'booking-1', members: [] })
      .mockResolvedValueOnce({ id: 'conversation-2', bookingId: 'booking-2', members: [] });

    await service.createBookingConversation('customer-1', 'booking-1');
    await service.createBookingConversation('customer-1', 'booking-2');

    expect(conversation.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { bookingId: 'booking-1' } }),
    );
    expect(conversation.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { bookingId: 'booking-2' } }),
    );
  });

  it('rejects a different technician from a DIRECT booking chat', async () => {
    booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      customerId: 'customer-1',
      assignmentMode: 'DIRECT',
      technicianId: 'profile-1',
      technician: { id: 'profile-1', userId: 'technician-1' },
      applications: [],
    });

    await expect(service.createBookingConversation('technician-2', 'booking-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects an empty text message', async () => {
    conversationMember.findUnique.mockResolvedValue({ userId: 'user-1' });
    await expect(service.sendMessage('user-1', 'conversation-1', { type: 'TEXT', text: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('does not accept a SYSTEM message from Mobile', async () => {
    conversationMember.findUnique.mockResolvedValue({ userId: 'user-1' });
    conversation.findUnique.mockResolvedValue({ bookingId: null });
    await expect(service.sendMessage('user-1', 'conversation-1', { type: 'SYSTEM' } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('does not let another user edit a message', async () => {
    message.findUnique.mockResolvedValue({ senderId: 'user-2', createdAt: new Date(), recalledAt: null, type: 'TEXT' });
    await expect(service.editMessage('user-1', 'message-1', { text: 'new text' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('does not edit a message after 15 minutes', async () => {
    message.findUnique.mockResolvedValue({
      senderId: 'user-1',
      createdAt: new Date(Date.now() - 16 * 60 * 1000),
      recalledAt: null,
      type: 'TEXT',
    });
    await expect(service.editMessage('user-1', 'message-1', { text: 'new text' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
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
