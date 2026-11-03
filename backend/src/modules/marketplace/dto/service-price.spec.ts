import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateAdminTechnicianPriceOptionDto, UpdateTechnicianServicePriceOptionDto } from './marketplace.dto';
import { CatalogPriceOptionDto } from './service-catalog.dto';

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
});
