import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateAdminTechnicianPriceOptionDto, UpdateTechnicianServicePriceOptionDto } from './marketplace.dto';
import { CatalogPriceOptionDto, CreateServiceCatalogDto, UpdateServiceCatalogDto } from './service-catalog.dto';

describe('service price range 400.000đ – 1.000.000đ', () => {
  const errors = async (dto: any, price: unknown) =>
    validate(plainToInstance(dto, { code: 'MIN_60', durationMinutes: 60, price }));

  describe.each([
    ['technician edits a price option', UpdateTechnicianServicePriceOptionDto],
    ['admin edits a technician price option', UpdateAdminTechnicianPriceOptionDto],
    ['admin edits the catalog', CatalogPriceOptionDto],
  ])('%s', (_label, dto) => {
    it.each([400000, 650000, 1000000])('accepts %d', async (price) => {
      expect(await errors(dto, price)).toHaveLength(0);
    });

    it.each([0, 399999, 1000001])('rejects %d with a readable message', async (price) => {
      const [error] = await errors(dto, price);
      expect(Object.values(error.constraints ?? {})).toContain('Gia dich vu phai tu 400.000d den 1.000.000d');
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
