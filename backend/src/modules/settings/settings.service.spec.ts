import { SettingsService } from './settings.service';

describe('SettingsService platform info and booking rules', () => {
  const subject = () => {
    const rows = new Map<string, string>();
    const prisma: any = {
      systemSetting: {
        findMany: jest.fn(async ({ where }: any) =>
          where.key.in.filter((key: string) => rows.has(key)).map((key: string) => ({ key, value: rows.get(key) }))),
        upsert: jest.fn(async ({ create }: any) => rows.set(create.key, create.value)),
      },
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const config = { get: (_key: string, fallback: unknown) => fallback };
    return { service: new SettingsService(prisma, config as any), rows };
  };

  it('falls back to defaults until the admin saves anything', async () => {
    const { service } = subject();
    await expect(service.getPlatformInfo()).resolves.toEqual({ brandName: 'Psyocore', hotline: '', supportEmail: '' });
    await expect(service.getBookingRules()).resolves.toEqual({ minAdvanceHours: 0, maxDispatchRadiusKm: 0, travelFeeThresholdKm: 10, travelFeeAmount: 0, confirmationWaitMinutes: 10, requireTechnicianPhone: false });
  });

  it('saves only the fields that were sent and returns the stored values', async () => {
    const { service, rows } = subject();
    await expect(service.setPlatformInfo({ hotline: '0901 234 567' })).resolves.toEqual({
      brandName: 'Psyocore',
      hotline: '0901 234 567',
      supportEmail: '',
    });
    await expect(service.setBookingRules({ minAdvanceHours: 2, maxDispatchRadiusKm: 15 })).resolves.toEqual({
      minAdvanceHours: 2,
      maxDispatchRadiusKm: 15,
      travelFeeThresholdKm: 10,
      travelFeeAmount: 0,
      confirmationWaitMinutes: 10,
      requireTechnicianPhone: false,
    });
    expect([...rows.keys()].sort()).toEqual(['BOOKING_MAX_DISPATCH_RADIUS_KM', 'BOOKING_MIN_ADVANCE_HOURS', 'PLATFORM_HOTLINE']);
  });

  it('exposes platform info and booking rules together for the apps', async () => {
    const { service } = subject();
    await service.setBookingRules({ minAdvanceHours: 1 });
    await expect(service.publicSettings()).resolves.toEqual({
      brandName: 'Psyocore',
      hotline: '',
      supportEmail: '',
      minAdvanceHours: 1,
      maxDispatchRadiusKm: 0,
      travelFeeThresholdKm: 10,
      travelFeeAmount: 0,
      confirmationWaitMinutes: 10,
      requireTechnicianPhone: false,
    });
  });
});
