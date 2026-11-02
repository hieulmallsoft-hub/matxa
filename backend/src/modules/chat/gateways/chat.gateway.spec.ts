import { ChatGateway } from './chat.gateway';

describe('REST to Mobile chat delivery', () => {
  it('publishes persisted admin REST messages to the Mobile user room', async () => {
    const chat = { recipientIds: jest.fn().mockResolvedValue(['customer']) };
    const gateway = new ChatGateway({} as any, {} as any, chat as any);
    const emit = jest.fn();
    gateway.server = { to: jest.fn().mockReturnValue({ emit }) } as any;
    const message = { id: 'message', conversationId: 'support', senderId: 'admin', text: 'Hello' };
    await gateway.publishRestMessage(message);
    expect(gateway.server.to).toHaveBeenCalledWith(['conversation:support', 'user:customer']);
    expect(emit).toHaveBeenCalledWith('message.created', message);
  });
});
