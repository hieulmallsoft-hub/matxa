import { BookingsService } from './bookings.service';
// Suspensions are covered by cancel-limit.spec; here nobody is suspended.
jest.mock('./cancel-limit', () => ({
  ...jest.requireActual('./cancel-limit'),
  activeSuspension: jest.fn().mockResolvedValue(null),
  assertNotSuspended: jest.fn().mockResolvedValue(undefined),
  applyCancelLimit: jest.fn().mockResolvedValue({ enabled: false, lockedUntil: null }),
}));

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

describe('technician job card shows the facility the customer comes to (ONSITE)', () => {
  const service = new BookingsService({} as any, { get: (_k: string, f: unknown) => f } as any, {} as any, {} as any);
  const own = { id: 'profile-1', facility: 'KTV Duc', address: '119a Tran Dai Nghia', city: 'HN', district: 'HN-PHUONG-BACH-MAI', latitude: 21.0065, longitude: 105.8484 };
  const job = (technicianId: string | null, status = 'CONFIRMED', mode = 'ONSITE') => ({
    id: 'booking-1', customerId: 'customer-1', technicianId, requestedTechnicianId: 'profile-1', mode, status,
    assignmentMode: 'OPEN_MARKETPLACE', items: [], applications: [], complaints: [], addressSnapshot: { city: 'HN' },
    scheduledStart: new Date(), scheduledEnd: new Date(), subtotal: 0, serviceFee: 0, totalAmount: 0,
  });
  const card = (booking: any, selected: boolean) => (service as any).openBookingResponse(booking, selected ? 'SELECTED' : null, selected, false, 'profile-1', own);

  it('is the technician’s own facility on a job they took or can still take', () => {
    const expected = { name: 'KTV Duc', address: '119a Tran Dai Nghia', city: 'HN', district: 'HN-PHUONG-BACH-MAI', latitude: 21.0065, longitude: 105.8484 };
    expect(card(job('profile-1'), true).facility).toEqual(expected);
    expect(card(job(null, 'OPEN'), false).facility).toEqual(expected);
  });

  it('is null for home jobs and once another technician took the job', () => {
    expect(card(job('profile-1', 'CONFIRMED', 'HOME'), true).facility).toBeNull();
    expect(card(job('profile-2'), false).facility).toBeNull();
  });
});

describe('a technician without a facility cannot take an ONSITE job', () => {
  const eligibility = (profile: object) => {
    const service: any = new BookingsService({} as any, { get: (_k: string, f: unknown) => f } as any, {} as any, {} as any);
    const db = {
      technicianProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'profile-1', userId: 'tech-1', city: 'HN', district: null, serviceModes: ['ONSITE'], latitude: null, longitude: null, ...profile }) },
      booking: { findFirst: jest.fn().mockResolvedValue(null) },
      technicianService: { findFirst: jest.fn().mockResolvedValue({ id: 'service-1' }) },
      availabilitySlot: { findFirst: jest.fn().mockResolvedValue({ id: 'slot-1' }) },
    };
    const booking = { id: 'b1', customerId: 'customer-1', assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN', mode: 'ONSITE', addressSnapshot: { city: 'HN' },
      items: [{ catalogService: { id: 'catalog-1', categoryId: 'category-1' } }], scheduledStart: new Date(Date.now() + 86_400_000), scheduledEnd: new Date(Date.now() + 90_000_000) };
    return service.assertOpenEligibility(db, booking, 'profile-1');
  };

  it('refuses with FACILITY_REQUIRED when neither a facility name nor an address is set', async () => {
    const error = await eligibility({ facility: null, address: '  ' }).catch((e: any) => e);
    expect(error.getResponse()).toMatchObject({ code: 'FACILITY_REQUIRED' });
  });

  it('accepts a technician with a facility address', async () => {
    await expect(eligibility({ facility: null, address: '119a Tran Dai Nghia' })).resolves.not.toThrow();
  });
});
