import { BookingsService } from './bookings.service';
import { addressPreview } from './distance';

// Fields the Figma waiting screen (customer) and job cards (technician) display.
describe('open booking display fields', () => {
  const service: any = new BookingsService(
    {} as any, { get: (_key: string, fallback: unknown) => fallback } as any, {} as any, {} as any,
  );
  // Customer at Bach Mai hospital; technicians ~2 km and ~5 km north.
  const customerAddress = {
    address: '52 Ngõ 15, Tổ 2A+Tổ 2B+Tổ 2C, Bạch Mai, Hà Nội',
    latitude: 21.0005, longitude: 105.8405, city: 'Ha Noi', district: 'Hai Ba Trung',
  };
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
  const booking = (applications: any[] = []) => ({
    id: 'booking-1', customerId: 'customer-1', assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN', mode: 'HOME',
    addressSnapshot: customerAddress, address: customerAddress, requestedTechnicianId: 'kim-profile',
    scheduledStart: new Date(Date.now() + 3_600_000), scheduledEnd: new Date(Date.now() + 7_200_000),
    items: [], applications, subtotal: 500000, serviceFee: 0, totalAmount: 500000, discountAmount: 0,
  });
  const applicant = (id: string, profile: object) => ({
    id: `${id}-application`, technicianProfileId: id, status: 'APPLIED', appliedAt: new Date(),
    technicianProfile: { user: { displayName: id, avatarUrl: null }, latitude: 21.0185, longitude: 105.8405, isAvailable: true, averageRating: 4.8, reviewCount: 15, createdAt: daysAgo(200), ...profile },
  });

  it('shows the customer how far each fallback technician is, whether they are ready and their tag', () => {
    const response = service.historyResponse(
      booking([
        applicant('mai', {}),
        applicant('lan', { averageRating: 0, reviewCount: 0, createdAt: daysAgo(3), isAvailable: false }),
        applicant('hoa', { averageRating: 4.0, reviewCount: 2, latitude: null, longitude: null }),
      ]),
      'customer-1',
    );
    expect(response.applications).toEqual([
      expect.objectContaining({ technicianId: 'mai', distanceKm: 2, isAvailable: true, badge: 'QUALITY' }),
      expect.objectContaining({ technicianId: 'lan', distanceKm: 2, isAvailable: false, badge: 'NEW' }),
      expect.objectContaining({ technicianId: 'hoa', distanceKm: null, isAvailable: true, badge: null }),
    ]);
  });

  it('shows the technician the distance and a partial address before they get the booking', () => {
    const response = service.openBookingResponse(booking(), null, false, true, 'mai-profile', { latitude: 21.0455, longitude: 105.8405 });
    expect(response).toMatchObject({
      distanceKm: 5,
      address: null,
      addressPreview: '… Tổ 2A+Tổ 2B+Tổ 2C, Bạch Mai, Hà Nội',
    });
  });

  it('falls back to district and city when the address has a single part', () => {
    expect(addressPreview({ address: '52 Ngõ 15', district: 'Hai Ba Trung', city: 'Ha Noi' })).toBe('Hai Ba Trung, Ha Noi');
    expect(addressPreview(null)).toBeNull();
  });
});
