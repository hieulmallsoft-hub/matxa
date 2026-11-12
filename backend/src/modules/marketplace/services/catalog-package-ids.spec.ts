import { ServiceCatalogService } from './service-catalog.service';

// Editing a catalog service must keep its package ids: apps hold priceOptionId, and past bookings point at them.
describe('admin edits a catalog service', () => {
  const current = {
    id: 'svc', pricingTemplate: 'STANDARD_60_90_120',
    priceOptions: [
      { id: 'opt-60', code: '60_MINUTES', durationMinutes: 60, price: 500000, sortOrder: 0, isActive: true },
      { id: 'opt-90', code: '90_MINUTES', durationMinutes: 90, price: 600000, sortOrder: 1, isActive: true },
      { id: 'opt-120', code: '120_MINUTES', durationMinutes: 120, price: 700000, sortOrder: 2, isActive: true },
    ],
  };
  const subject = (bookedOptionIds: string[]) => {
    const tx: any = {
      serviceCatalogPriceOption: { update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
      bookingItem: { count: jest.fn(async ({ where }: any) => (bookedOptionIds.includes(where.catalogPriceOptionId) ? 1 : 0)) },
      serviceCatalogItem: { update: jest.fn(async ({ data }: any) => data) },
    };
    const prisma: any = {
      serviceCatalogItem: { findUnique: jest.fn().mockResolvedValue(current) },
      $transaction: jest.fn((callback: any) => callback(tx)),
    };
    const service = new ServiceCatalogService(prisma);
    jest.spyOn(service as any, 'validateTemplate').mockReturnValue(undefined);
    return { tx, service };
  };

  it('updates packages in place by code instead of recreating them', async () => {
    const { tx, service } = subject([]);
    await service.update('svc', { name: 'Moi' } as any);
    expect(tx.serviceCatalogPriceOption.deleteMany).not.toHaveBeenCalled();
    expect(tx.serviceCatalogPriceOption.update.mock.calls.map((call: any) => call[0].where.id)).toEqual(['opt-60', 'opt-90', 'opt-120']);
    expect(tx.serviceCatalogItem.update.mock.calls[0][0].data.priceOptions.create).toEqual([]);
  });

  it('changes a price without changing the id, adds new packages, and drops removed ones', async () => {
    const { tx, service } = subject(['opt-120']);
    await service.update('svc', {
      priceOptions: [
        { code: '60_minutes', durationMinutes: 60, price: 550000 },
        { code: '180_MINUTES', durationMinutes: 180, price: 900000 },
      ],
    } as any);
    expect(tx.serviceCatalogPriceOption.update).toHaveBeenCalledWith({
      where: { id: 'opt-60' }, data: { durationMinutes: 60, price: 550000, sortOrder: 0, isActive: true },
    });
    // 90 was never booked: deleted. 120 was booked: kept for history, switched off.
    expect(tx.serviceCatalogPriceOption.delete).toHaveBeenCalledWith({ where: { id: 'opt-90' } });
    expect(tx.serviceCatalogPriceOption.update).toHaveBeenCalledWith({ where: { id: 'opt-120' }, data: { isActive: false } });
    expect(tx.serviceCatalogItem.update.mock.calls[0][0].data.priceOptions.create).toEqual([
      { code: '180_MINUTES', durationMinutes: 180, price: 900000, sortOrder: 0, isActive: true },
    ]);
  });
  it('a package switched off for past bookings does not block the next edit', async () => {
    const { service } = subject([]);
    (service as any).validateTemplate.mockRestore();
    expect(() => (service as any).validateTemplate('FIXED_60', [
      { durationMinutes: 60 }, { durationMinutes: 90, isActive: false },
    ])).not.toThrow();
    expect(() => (service as any).validateTemplate('FIXED_60', [{ durationMinutes: 60 }, { durationMinutes: 90 }])).toThrow();
  });
});
