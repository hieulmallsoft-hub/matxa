import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TechnicianJobQueryDto } from '../dto/booking.dto';
import { BookingsService } from './bookings.service';

// Technician "Việc của tôi" cards and detail per Figma.
describe('technician job card', () => {
  const config = { get: (_key: string, fallback: unknown) => fallback } as any;
  const service: any = new BookingsService({} as any, config, {} as any, {} as any);
  const job = (overrides: object = {}) => ({
    id: 'booking-1', assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN', mode: 'HOME', technicianId: null,
    requestedTechnicianId: 'duc-profile', items: [], subtotal: 500000, serviceFee: 0, totalAmount: 500000,
    grossServiceAmount: 500000, platformFee: 0, technicianEarning: 500000,
    scheduledStart: new Date(Date.now() + 7_200_000), scheduledEnd: new Date(Date.now() + 10_800_000),
    applicationDeadlineAt: new Date(Date.now() + 600_000), addressSnapshot: { address: '52 Ngõ 15, Bạch Mai, Hà Nội' },
    ...overrides,
  });
  const card = (booking: any, applicationStatus: string | null, viewer = 'fftools-profile', selected = false) =>
    service.openBookingResponse(booking, applicationStatus, selected, true, viewer, undefined, 25);

  it.each([
    ['REQUESTED', job(), null, 'duc-profile', false],
    ['NEW', job(), null, 'fftools-profile', false],
    ['APPLIED', job(), 'APPLIED', 'fftools-profile', false],
    ['DECLINED', job(), 'DECLINED', 'duc-profile', false],
    ['NOT_SELECTED', job({ status: 'CONFIRMED', technicianId: 'mai-profile' }), 'NOT_SELECTED', 'fftools-profile', false],
    ['NOT_SELECTED', job({ status: 'CONFIRMED', technicianId: 'mai-profile' }), null, 'duc-profile', false],
    ['ACCEPTED', job({ status: 'CONFIRMED', technicianId: 'fftools-profile' }), 'SELECTED', 'fftools-profile', true],
    ['COMPLETED', job({ status: 'COMPLETED', technicianId: 'fftools-profile' }), 'SELECTED', 'fftools-profile', true],
    ['CANCELLED', job({ status: 'CANCELLED' }), 'EXPIRED', 'fftools-profile', false],
    ['EXPIRED', job({ status: 'EXPIRED' }), null, 'fftools-profile', false],
  ])('shows %s', (expected, booking, applicationStatus, viewer, selected) => {
    expect(card(booking, applicationStatus, viewer, selected).displayStatus).toBe(expected);
  });

  it('shows what the technician will really earn before the commission is charged', () => {
    expect(card(job(), null).pricing).toMatchObject({
      grossServiceAmount: 500000, platformFee: 125000, technicianEarning: 375000, isEstimate: true,
    });
  });

  it('shows the charged amounts once the job is theirs', () => {
    const accepted = job({ status: 'CONFIRMED', technicianId: 'fftools-profile', platformFee: 115000, technicianEarning: 385000 });
    expect(card(accepted, 'SELECTED', 'fftools-profile', true).pricing).toMatchObject({
      platformFee: 115000, technicianEarning: 385000, isEstimate: false,
    });
  });

  it('accepts several services in the filter, comma-separated or repeated', async () => {
    const a = '0b8f5a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b';
    const b = '1c9a6b3f-2d4e-4f6a-9b0c-1d2e3f4a5b6c';
    const parsed = plainToInstance(TechnicianJobQueryDto, { serviceIds: `${a},${b}` });
    expect(await validate(parsed)).toHaveLength(0);
    expect(parsed.serviceIds).toEqual([a, b]);
  });
});

describe('direct booking job card', () => {
  const service: any = new BookingsService({} as any, { get: (_k: string, f: unknown) => f } as any, {} as any, {} as any);
  const direct = (status: string) => ({
    id: 'booking-1', assignmentMode: 'DIRECT', status, technicianId: 'duc-profile', customerId: 'customer-1',
    items: [], subtotal: 500000, serviceFee: 0, totalAmount: 500000, discountAmount: 0, grossServiceAmount: 500000,
    platformFee: 0, technicianEarning: 500000, scheduledStart: new Date(), scheduledEnd: new Date(),
  });
  it.each([
    ['PENDING', 'REQUESTED'], ['CONFIRMED', 'ACCEPTED'], ['COMPLETED', 'COMPLETED'],
    ['CANCELLED', 'CANCELLED'], ['EXPIRED', 'EXPIRED'],
  ])('labels a %s direct booking %s', (status, expected) => {
    expect(service.technicianJobResponse(direct(status), 'duc-user').displayStatus).toBe(expected);
  });
});
