import { ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';

// A complaint chat belongs to the customer who complained and the admins.
describe('complaint chat access', () => {
  const thread = { id: 'conversation-1', type: 'COMPLAINT', bookingId: null, supportCustomerId: null, customerId: 'customer-1' };
  const roles: Record<string, string> = { 'customer-1': 'CUSTOMER', 'other-customer': 'CUSTOMER', 'ktv-user': 'TECHNICIAN', 'admin-1': 'ADMIN' };

  const subject = () => {
    const prisma: any = {
      conversation: { findUnique: jest.fn().mockResolvedValue(thread) },
      conversationMember: {
        findUnique: jest.fn(async ({ where }: any) => (where.conversationId_userId.userId === 'customer-1' ? { userId: 'customer-1' } : null)),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(async ({ create }: any) => create),
      },
      user: {
        findUnique: jest.fn(async ({ where }: any) => ({ role: roles[where.id] })),
        findMany: jest.fn().mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]),
      },
    };
    return { service: new ChatService(prisma, {} as any, {} as any), prisma };
  };

  it('lets the customer who complained and any admin in', async () => {
    const { service } = subject();
    await expect(service.ensureCanWrite('customer-1', 'conversation-1')).resolves.toBeDefined();
    await expect(service.ensureCanWrite('admin-1', 'conversation-1')).resolves.toBeDefined();
    await expect(service.ensureMember('admin-1', 'conversation-1')).resolves.toBeDefined();
  });

  it.each(['ktv-user', 'other-customer'])('keeps %s out', async (userId) => {
    const { service } = subject();
    await expect(service.ensureCanWrite(userId, 'conversation-1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.ensureMember(userId, 'conversation-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('routes the customer message to the admins and an admin reply to the customer', async () => {
    const { service } = subject();
    await expect(service.recipientIds('customer-1', 'conversation-1')).resolves.toEqual(['admin-1', 'admin-2']);
    await expect(service.recipientIds('admin-1', 'conversation-1')).resolves.toEqual(['customer-1']);
  });

  it('renders the complaint system messages as readable text', async () => {
    const { service } = subject();
    const render = (text: string) => (service as any).withSystemMessageText({ type: 'SYSTEM', text });
    await expect(render('COMPLAINT_CREATED')).resolves.toMatchObject({
      systemEvent: 'COMPLAINT_CREATED', text: 'Bạn đã gửi khiếu nại. CSKH sẽ phản hồi tại đây.',
    });
    await expect(render('COMPLAINT_STATUS:RESOLVED')).resolves.toMatchObject({
      systemEvent: 'COMPLAINT_STATUS_CHANGED', complaintStatus: 'RESOLVED', text: 'Khiếu nại đã chuyển sang: Đã giải quyết',
    });
  });
});
