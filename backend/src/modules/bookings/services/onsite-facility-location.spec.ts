import { BookingsService } from './bookings.service';

describe('customer booking shows where the facility is (ONSITE)', () => {
  const service = new BookingsService({} as any, { get: (_k: string, f: unknown) => f } as any, {} as any, {} as any);
  const profile = {
    id: 'profile-1',
    facility: 'Spa Hoa Sen',
    address: '12 Ly Thuong Kiet, Hoan Kiem',
    city: 'HN',
    district: 'HN-HK',
    latitude: '21.0208713',
    longitude: '105.8577338',
    user: { id: 'tech-1', displayName: 'Luna', avatarUrl: null },
  };
  const booking = (mode: string, technician: any = profile) => ({
    id: 'booking-1', customerId: 'customer-1', technicianId: technician?.id ?? null, mode, status: 'CONFIRMED',
    assignmentMode: 'DIRECT', items: [], applications: [], complaints: [], technician,
    subtotal: 0, serviceFee: 0, discountAmount: 0, totalAmount: 0,
  });
  const view = (value: any) => (service as any).historyResponse(value, 'customer-1');

  it('returns the facility name, address and map coordinates', () => {
    expect(view(booking('ONSITE')).facility).toEqual({
      name: 'Spa Hoa Sen', address: '12 Ly Thuong Kiet, Hoan Kiem', city: 'HN', district: 'HN-HK',
      latitude: 21.0208713, longitude: 105.8577338,
    });
  });

  it('is null for home bookings and before a technician is assigned', () => {
    expect(view(booking('HOME')).facility).toBeNull();
    expect(view(booking('ONSITE', null)).facility).toBeNull();
  });

  it('shows each applicant facility on an open ONSITE booking', () => {
    const open = { ...booking('ONSITE', null), assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN',
      applications: [{ id: 'a1', technicianProfileId: 'profile-1', status: 'APPLIED', technicianProfile: profile }] };
    expect(view(open).applications[0].facility).toMatchObject({ name: 'Spa Hoa Sen', latitude: 21.0208713 });
  });
});
