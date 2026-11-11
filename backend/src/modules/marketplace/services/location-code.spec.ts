import { BadRequestException } from '@nestjs/common';
import { resolveLocationCodes } from './location-code';

const db: any = {
  city: {
    findMany: jest.fn().mockResolvedValue([
      { code: 'HN', name: 'Hà Nội' },
      { code: 'HCM', name: 'Hồ Chí Minh' },
      { code: 'DN', name: 'Đà Nẵng' },
    ]),
  },
  district: {
    findMany: jest.fn(async ({ where }: any) =>
      where.cityCode === 'HN' ? [{ code: 'HN-HK', name: 'Hoàn Kiếm' }, { code: 'HN-BD', name: 'Ba Đình' }] : []),
  },
};

describe('technician city/district are stored as codes', () => {
  it.each([
    ['HN', 'HN'],
    ['hn', 'HN'],
    ['Hà Nội', 'HN'],
    ['  ha noi ', 'HN'],
    ['Thành phố Hà Nội', 'HN'],
    ['TP. Hồ Chí Minh', 'HCM'],
    ['Đà Nẵng', 'DN'],
    ['da nang', 'DN'],
  ])('%s → %s', async (input, code) => {
    await expect(resolveLocationCodes(db, input)).resolves.toEqual({ city: code, district: undefined });
  });

  it('maps a district name inside the chosen city', async () => {
    await expect(resolveLocationCodes(db, 'Hà Nội', 'Quận Hoàn Kiếm')).resolves.toEqual({ city: 'HN', district: 'HN-HK' });
    await expect(resolveLocationCodes(db, 'HN', 'HN-BD')).resolves.toEqual({ city: 'HN', district: 'HN-BD' });
  });

  it('maps a ward name with or without its "Phuong/Xa" prefix, preferring the exact full name', async () => {
    const wards: any = {
      city: db.city,
      district: { findMany: jest.fn().mockResolvedValue([
        { code: 'HN-PHUONG-CAU-GIAY', name: 'Phường Cầu Giấy' },
        { code: 'HN-PHUONG-YEN-HOA', name: 'Phường Yên Hòa' },
        { code: 'HN-XA-YEN-HOA', name: 'Xã Yên Hòa' },
      ]) },
    };
    await expect(resolveLocationCodes(wards, 'HN', 'Cầu Giấy')).resolves.toEqual({ city: 'HN', district: 'HN-PHUONG-CAU-GIAY' });
    await expect(resolveLocationCodes(wards, 'HN', 'phuong cau giay')).resolves.toEqual({ city: 'HN', district: 'HN-PHUONG-CAU-GIAY' });
    await expect(resolveLocationCodes(wards, 'HN', 'Xã Yên Hòa')).resolves.toEqual({ city: 'HN', district: 'HN-XA-YEN-HOA' });
  });

  it('rejects an unknown city or a district of another city', async () => {
    await expect(resolveLocationCodes(db, 'Paris')).rejects.toBeInstanceOf(BadRequestException);
    await expect(resolveLocationCodes(db, 'HCM', 'Hoàn Kiếm')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps fields that were not sent, and clears empty ones', async () => {
    await expect(resolveLocationCodes(db, undefined, undefined)).resolves.toEqual({ city: undefined, district: undefined });
    await expect(resolveLocationCodes(db, 'HN', '')).resolves.toEqual({ city: 'HN', district: null });
  });
});
