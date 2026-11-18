import { BadRequestException } from '@nestjs/common';

/**
 * The facility's coordinates to store from a profile/application update. They come in pairs, and a new facility address
 * must come with its point on the map, so the text and the map pin never point at two different places. Clearing the
 * address clears the point.
 */
export function facilityCoordinates(
  dto: { address?: string | null; facilityLatitude?: number; facilityLongitude?: number },
  currentAddress: string | null | undefined,
): { facilityLatitude?: number | null; facilityLongitude?: number | null } {
  const hasLatitude = dto.facilityLatitude !== undefined && dto.facilityLatitude !== null;
  const hasLongitude = dto.facilityLongitude !== undefined && dto.facilityLongitude !== null;
  if (hasLatitude !== hasLongitude)
    throw new BadRequestException({ code: 'FACILITY_LOCATION_INCOMPLETE', message: 'Cần gửi cả vĩ độ và kinh độ của cơ sở' });
  const address = dto.address === undefined ? undefined : dto.address?.trim() || null;
  if (address === null) return { facilityLatitude: null, facilityLongitude: null };
  const addressChanged = address !== undefined && address !== (currentAddress?.trim() || null);
  if (addressChanged && !hasLatitude)
    throw new BadRequestException({ code: 'FACILITY_LOCATION_REQUIRED', message: 'Vui lòng chọn vị trí cơ sở trên bản đồ' });
  return hasLatitude ? { facilityLatitude: dto.facilityLatitude, facilityLongitude: dto.facilityLongitude } : {};
}
