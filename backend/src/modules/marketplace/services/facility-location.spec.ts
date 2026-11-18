import { BadRequestException } from '@nestjs/common';
import { facilityCoordinates } from './facility-location';

describe('facility map point', () => {
  const code = (fn: () => unknown) => {
    try {
      fn();
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      return ((error as BadRequestException).getResponse() as { code: string }).code;
    }
    return null;
  };

  it('stores the point picked on the map with the address', () => {
    expect(facilityCoordinates({ address: '43 Cầu Giấy', facilityLatitude: 21.03047, facilityLongitude: 105.80082 }, '119a Trần Đại Nghĩa')).toEqual({
      facilityLatitude: 21.03047,
      facilityLongitude: 105.80082,
    });
  });

  it('refuses a new address without its point, so the text and the pin cannot disagree', () => {
    expect(code(() => facilityCoordinates({ address: '119a Trần Đại Nghĩa' }, '43 Cầu Giấy'))).toBe('FACILITY_LOCATION_REQUIRED');
    expect(code(() => facilityCoordinates({ address: '43 Cầu Giấy' }, null))).toBe('FACILITY_LOCATION_REQUIRED');
  });

  it('accepts the same address resent without a point, and leaves the stored point alone', () => {
    expect(facilityCoordinates({ address: ' 43 Cầu Giấy ' }, '43 Cầu Giấy')).toEqual({});
    expect(facilityCoordinates({}, '43 Cầu Giấy')).toEqual({});
  });

  it('needs both coordinates', () => {
    expect(code(() => facilityCoordinates({ facilityLatitude: 21 }, null))).toBe('FACILITY_LOCATION_INCOMPLETE');
  });

  it('clears the point with the address', () => {
    expect(facilityCoordinates({ address: '' }, '43 Cầu Giấy')).toEqual({ facilityLatitude: null, facilityLongitude: null });
  });
});
