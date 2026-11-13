import { BookingsService } from './bookings.service';

it('a technician whose profile the admin hid is told so, with the reason', async () => {
  const prisma: any = {
    technicianProfile: { findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ hiddenReason: 'Anh dai dien khong phu hop' }) },
  };
  const service: any = new BookingsService(prisma, { get: (_k: string, f: unknown) => f } as any, {} as any, {} as any);
  const error = await service.requireActiveTechnician('tech-user').catch((e: any) => e);
  expect(error.getStatus()).toBe(403);
  expect(error.getResponse()).toMatchObject({ code: 'PROFILE_HIDDEN', reason: 'Anh dai dien khong phu hop' });
});
