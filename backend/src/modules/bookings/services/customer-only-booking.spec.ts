import { ForbiddenException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

// A technician account could place bookings like a customer; only customer accounts may book.
describe('only customers can book', () => {
  const setup = (user: { role: string; status: string } | null) => {
    const prisma: any = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
    return new BookingsService(prisma, { get: (_k: string, d: unknown) => d } as any, {} as any, {} as any);
  };
  const dto: any = { items: [], mode: 'HOME', city: 'HN', scheduledStart: new Date(Date.now() + 86_400_000).toISOString() };

  it.each([
    ['tạo đơn', (s: BookingsService) => s.createOpen('tech', dto)],
    ['tạo đơn chọn KTV', (s: BookingsService) => s.createSelectedFromCatalog('tech', { ...dto, technicianId: 'x' })],
    ['tìm KTV phù hợp', (s: BookingsService) => s.matchingTechnicians('tech', dto)],
    ['báo giá', (s: BookingsService) => s.quote('tech', { ...dto, technicianId: 'x', serviceIds: [] })],
  ])('refuses a technician account (%s) with CUSTOMER_ONLY', async (_name, call) => {
    const error = await call(setup({ role: 'TECHNICIAN', status: 'ACTIVE' })).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      code: 'CUSTOMER_ONLY',
      message: 'Tai khoan KTV khong dat lich duoc. Vui long dung tai khoan khach hang',
    });
  });

  it('refuses admins and locked customers too', async () => {
    await expect(setup({ role: 'ADMIN', status: 'ACTIVE' }).createOpen('admin', dto)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(setup({ role: 'CUSTOMER', status: 'LOCKED' }).createOpen('c', dto)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets an active customer through to the booking rules', async () => {
    const service = setup({ role: 'CUSTOMER', status: 'ACTIVE' });
    // Passes the role check and fails later on the (empty) request, not with CUSTOMER_ONLY.
    const error = await service.createOpen('customer', { ...dto, scheduledStart: 'not-a-date' }).catch((e: unknown) => e);
    expect((error as any)?.getResponse?.()?.code).not.toBe('CUSTOMER_ONLY');
  });
});
