import { NotFoundException } from '@nestjs/common';
import { ChatController } from './chat.controller';

describe('ChatController support entry', () => {
  function setup(supportCustomerId = 'customer') {
    const chat: any = {
      venueInquiryText: jest.fn().mockResolvedValue('Mình muốn đặt lịch tại Spa (Addr).'),
      createSupportConversation: jest.fn().mockResolvedValue({ id: 'support-1', supportCustomerId }),
      sendMessage: jest.fn().mockResolvedValue({ id: 'm1', conversationId: 'support-1', senderId: 'customer' }),
    };
    const gateway: any = { publishRestMessage: jest.fn() };
    return { chat, gateway, controller: new ChatController(chat, {} as any, gateway, {} as any) };
  }

  it('sends the venue inquiry as the customer and publishes it to CSKH', async () => {
    const { controller, chat, gateway } = setup();
    const result: any = await controller.createSupport({ sub: 'customer', sid: 's' }, { venueId: 'venue' });
    expect(chat.sendMessage).toHaveBeenCalledWith('customer', 'support-1', { type: 'TEXT', text: 'Mình muốn đặt lịch tại Spa (Addr).' });
    expect(gateway.publishRestMessage).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }));
    expect(result.inquiryMessage).toMatchObject({ id: 'm1' });
  });

  it('opens a plain thread without venueId and never posts on behalf of a customer for an admin', async () => {
    const plain = setup();
    await plain.controller.createSupport({ sub: 'customer', sid: 's' }, {});
    expect(plain.chat.sendMessage).not.toHaveBeenCalled();
    const admin = setup('customer');
    await admin.controller.createSupport({ sub: 'admin', sid: 's' }, { customerId: 'customer', venueId: 'venue' });
    expect(admin.chat.sendMessage).not.toHaveBeenCalled();
  });

  it('does not open the thread when the venue is unknown', async () => {
    const { controller, chat } = setup();
    chat.venueInquiryText.mockRejectedValue(new NotFoundException());
    await expect(controller.createSupport({ sub: 'customer', sid: 's' }, { venueId: 'bad' })).rejects.toBeInstanceOf(NotFoundException);
    expect(chat.createSupportConversation).not.toHaveBeenCalled();
  });
});
