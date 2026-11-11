import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';

type LocationDb = Pick<Prisma.TransactionClient, 'city' | 'district'>;

/** "Thành phố Hà Nội", "TP. Hà Nội", "ha noi" → "ha noi". */
const normalize = (value: string, prefixes: RegExp) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(prefixes, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const CITY_PREFIX = /^\s*(thanh pho|tp|tinh)\s+/;
// Since the July 2025 reform the second level is the ward/commune (phuong/xa/dac khu); the table keeps its name.
const DISTRICT_PREFIX = /^\s*(phuong|xa|dac khu|p|quan|huyen|thi xa|thanh pho|tp|q|h)\s+/;

const match = <T extends { code: string; name: string }>(rows: T[], value: string, prefixes: RegExp) => {
  const code = value.trim().toUpperCase();
  const full = normalize(value, /^$/);
  const name = normalize(value, prefixes);
  // Full name first: a province can have both "Phuong X" and "Xa X".
  return (
    rows.find((row) => row.code.toUpperCase() === code) ??
    rows.find((row) => normalize(row.name, /^$/) === full) ??
    rows.find((row) => normalize(row.name, prefixes) === name)
  );
};

/**
 * Technician city/district are stored as codes (locations/cities, …/districts), which search and matching filter on.
 * Accept a code or a name — an app once sent "Hà Nội" when its city list failed to load — store the code, and reject
 * anything that is neither. `undefined` stays undefined (field not sent); empty district becomes null.
 */
export async function resolveLocationCodes(db: LocationDb, city: string | null | undefined, district?: string | null) {
  let cityCode: string | null | undefined = city;
  if (city !== undefined && city !== null) {
    if (!city.trim()) cityCode = null;
    else {
      const found = match(await db.city.findMany({ where: { isActive: true }, select: { code: true, name: true } }), city, CITY_PREFIX);
      if (!found) throw new BadRequestException({ code: 'INVALID_CITY', message: 'Tinh/thanh pho khong hop le' });
      cityCode = found.code;
    }
  }
  let districtCode: string | null | undefined = district;
  if (district !== undefined && district !== null) {
    if (!district.trim()) districtCode = null;
    else {
      if (!cityCode) throw new BadRequestException({ code: 'INVALID_DISTRICT', message: 'Chon tinh/thanh pho truoc khi chon phuong/xa' });
      const rows = await db.district.findMany({ where: { cityCode, isActive: true }, select: { code: true, name: true } });
      const found = match(rows, district, DISTRICT_PREFIX);
      if (!found) throw new BadRequestException({ code: 'INVALID_DISTRICT', message: 'Phuong/xa khong thuoc tinh/thanh pho da chon' });
      districtCode = found.code;
    }
  }
  return { city: cityCode, district: districtCode };
}
