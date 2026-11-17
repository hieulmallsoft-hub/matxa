import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateAdminTechnicianPriceOptionDto, UpdateTechnicianServicePriceOptionDto } from './marketplace.dto';
import { CatalogPriceOptionDto, CreateServiceCatalogDto, UpdateServiceCatalogDto } from './service-catalog.dto';
import { assertServicePrices } from '../../settings/settings.service';

// The allowed range is the admin's setting (400.000-1.000.000đ by default, lowered to test payments); the DTOs only
// reject nonsense.
describe('service price range', () => {
  const db = (rows: Array<{ key: string; value: string }> = []) => ({ systemSetting: { findMany: jest.fn().mockResolvedValue(rows) } }) as any;
  const code = (promise: Promise<unknown>) => promise.then(() => 'ok', (error) => error.getResponse().code);

  it.each([400000, 650000, 1000000])('accepts %d by default', async (price) => {
    await expect(code(assertServicePrices(db(), [price]))).resolves.toBe('ok');
  });

  it.each([399999, 1000001])('rejects %d by default with the range in the message', async (price) => {
    const error = await assertServicePrices(db(), [price]).catch((e) => e);
    expect(error.getResponse()).toMatchObject({ code: 'SERVICE_PRICE_OUT_OF_RANGE', message: 'Gia dich vu phai tu 400.000d den 1.000.000d', min: 400000, max: 1000000 });
  });

  it('follows the admin setting, e.g. 10.000đ for testing payments', async () => {
    const lowered = db([{ key: 'SERVICE_PRICE_MIN_VND', value: '10000' }]);
    await expect(code(assertServicePrices(lowered, [10000, 500000]))).resolves.toBe('ok');
    await expect(code(assertServicePrices(lowered, [9000]))).resolves.toBe('SERVICE_PRICE_OUT_OF_RANGE');
  });

  describe.each([
    ['technician edits a price option', UpdateTechnicianServicePriceOptionDto],
    ['admin edits a technician price option', UpdateAdminTechnicianPriceOptionDto],
    ['admin edits the catalog', CatalogPriceOptionDto],
  ])('%s: the request itself', (_label, dto) => {
    const errors = (price: unknown) => validate(plainToInstance(dto as any, { code: 'MIN_60', durationMinutes: 60, price }));
    it('accepts a small price (the range is checked against the setting)', async () => {
      expect(await errors(10000)).toHaveLength(0);
    });
    it.each([0, 999, 100_000_001])('rejects %d as nonsense', async (price) => {
      expect(await errors(price)).not.toHaveLength(0);
    });
  });

  it.each([
    ['creating', CreateServiceCatalogDto],
    ['updating', UpdateServiceCatalogDto],
  ])('checks every price option when %s a catalog service', async (_label, dto: any) => {
    const body = {
      categoryId: '7d6c3c6e-4a3f-4f0e-9b8a-2f6d5a1c9e10', slug: 'massage', name: 'Massage',
      pricingTemplate: 'STANDARD_60_90_120', modes: ['HOME'],
      priceOptions: [
        { code: '60_MINUTES', durationMinutes: 60, price: 500000 },
        { code: '90_MINUTES', durationMinutes: 90, price: 23232323232 },
      ],
    };
    expect(await validate(plainToInstance(dto, body))).not.toHaveLength(0);
    body.priceOptions[1].price = 700000;
    expect(await validate(plainToInstance(dto, body))).toHaveLength(0);
  });
});
