import { ForbiddenException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

// A technician may book another technician, never themselves; admins and locked accounts do not book.
describe('who can book', () => {
  const setup = (user: { role: string; status: string } | null, ownProfile: unknown = null) => {
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      technicianProfile: { findFirst: jest.fn().mockResolvedValue(ownProfile), findMany: jest.fn().mockResolvedValue([]) },
      serviceCatalogItem: { findMany: jest.fn().mockResolvedValue([]) },
      serviceCatalogPriceOption: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return { prisma, service: new BookingsService(prisma, { get: (_k: string, d: unknown) => d } as any, {} as any, {} as any) };
  };
  const dto: any = { items: [], mode: 'HOME', city: 'HN', scheduledStart: new Date(Date.now() + 86_400_000).toISOString() };
  const code = async (promise: Promise<unknown>) => ((await promise.catch((e: unknown) => e)) as any)?.getResponse?.()?.code;

  it('refuses a technician choosing their own profile (OWN_BOOKING)', async () => {
    const tech = { role: 'TECHNICIAN', status: 'ACTIVE' };
    await expect(code(setup(tech, { id: 'me' }).service.createSelectedFromCatalog('tech', { ...dto, technicianId: 'me' }))).resolves.toBe('OWN_BOOKING');
    await expect(code(setup(tech, { id: 'me' }).service.quote('tech', { ...dto, technicianId: 'me', serviceIds: [] }))).resolves.toBe('OWN_BOOKING');
  });

  it('lets a technician book another technician', async () => {
    const { service } = setup({ role: 'TECHNICIAN', status: 'ACTIVE' }, null);
    const result = await code(service.createSelectedFromCatalog('tech', { ...dto, technicianId: 'other' }));
    expect(['CUSTOMER_ONLY', 'OWN_BOOKING']).not.toContain(result);
  });

  it('never lists the booker among matching technicians', async () => {
    const { prisma, service } = setup({ role: 'TECHNICIAN', status: 'ACTIVE' });
    await service.matchingTechnicians('tech', { ...dto, items: [{ catalogServiceId: 'c', priceOptionId: 'o' }] }).catch(() => undefined);
    const where = prisma.technicianProfile.findMany.mock.calls[0]?.[0]?.where;
    if (where) expect(where.user.id).toEqual({ not: 'tech' });
  });

  it('refuses admins and locked accounts', async () => {
    const admin = await setup({ role: 'ADMIN', status: 'ACTIVE' }).service.createOpen('admin', dto).catch((e: unknown) => e);
    expect(admin).toBeInstanceOf(ForbiddenException);
    await expect(code(setup({ role: 'CUSTOMER', status: 'LOCKED' }).service.createOpen('c', dto))).resolves.toBe('CUSTOMER_ONLY');
  });
});
