import { BookingsService } from './bookings.service';
import { travelFeeFor } from './distance';

const rules = { minAdvanceHours: 0, maxDispatchRadiusKm: 0, travelFeeThresholdKm: 10, travelFeeAmount: 50_000 };

describe('travelFeeFor', () => {
  it('charges the flat fee only for a home booking beyond the threshold', () => {
    expect(travelFeeFor('HOME', 10.1, rules)).toBe(50_000);
    expect(travelFeeFor('HOME', 25, rules)).toBe(50_000);
    expect(travelFeeFor('HOME', 10, rules)).toBe(0);
    expect(travelFeeFor('ONSITE', 25, rules)).toBe(0);
  });

  it('charges nothing when the distance is unknown or no fee is configured', () => {
    expect(travelFeeFor('HOME', null, rules)).toBe(0);
    expect(travelFeeFor('HOME', 25, { ...rules, travelFeeAmount: 0 })).toBe(0);
  });
});

describe('travel fee when the customer picks a technician', () => {
  // Hoan Kiem, Ha Noi (customer) and two technicians: about 3 km and about 17 km away.
  const customer = { latitude: 21.0285, longitude: 105.8542, address: '1 Trang Tien', city: 'HN' };
  const near = { latitude: 21.0, longitude: 105.83 };
  const far = { latitude: 21.14, longitude: 105.75 };

  const select = async (technicianLocation: { latitude: number; longitude: number }) => {
    const winner = {
      id: 'application-1',
      technicianProfileId: 'tech-profile-1',
      technicianProfile: { ...technicianLocation, user: { id: 'tech-user-1' } },
    };
    const booking = {
      id: 'booking-1', customerId: 'customer-1', assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN', technicianId: null,
      mode: 'HOME', addressSnapshot: customer, travelFee: 0,
      scheduledStart: new Date(Date.now() + 3_600_000), scheduledEnd: new Date(Date.now() + 7_200_000),
      items: [{ catalogService: { categoryId: 'category-1' }, durationMinutes: 60 }],
    };
    const tx: any = {
      booking: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(booking),
        findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValue({ grossServiceAmount: 0 }),
        update: jest.fn(async ({ data }: any) => ({ ...booking, ...data, payment: { method: 'CASH' } })),
      },
      bookingTechnicianApplication: {
        findFirst: jest.fn().mockResolvedValue(winner),
        update: jest.fn().mockResolvedValue(winner),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      technicianProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'tech-profile-1', city: 'HN', district: null, serviceModes: ['HOME'] }) },
      technicianService: { findFirst: jest.fn().mockResolvedValue({ id: 'service-1' }) },
      availabilitySlot: { findFirst: jest.fn().mockResolvedValue({ id: 'slot-1' }) },
    };
    const prisma: any = { $transaction: jest.fn(async (callback: any) => callback(tx)) };
    const service = new BookingsService(
      prisma,
      { get: jest.fn((_key: string, fallback: unknown) => fallback) } as any,
      { create: jest.fn(), sendPush: jest.fn() } as any,
      {} as any,
      undefined,
      undefined,
      undefined,
      { getBookingRules: jest.fn().mockResolvedValue(rules), platformFeePercent: jest.fn().mockResolvedValue(0) } as any,
    );
    await service.selectTechnician('customer-1', 'booking-1', 'application-1');
    return tx.booking.update.mock.calls[0][0].data;
  };

  it('adds the fee to what the customer pays and what the technician earns when they live beyond 10 km', async () => {
    const data = await select(far);
    expect(data.travelFee).toBe(50_000);
    expect(Number(data.travelDistanceKm)).toBeGreaterThan(10);
    expect(data).toMatchObject({
      totalAmount: { increment: 50_000 },
      customerPayableAmount: { increment: 50_000 },
      technicianEarning: { increment: 50_000 },
      payment: { update: { amount: { increment: 50_000 } } },
    });
    expect(data).not.toHaveProperty('platformFee');
  });

  it('adds nothing for a technician within 10 km', async () => {
    const data = await select(near);
    expect(data.travelFee).toBe(0);
    expect(data).not.toHaveProperty('totalAmount');
    expect(data).not.toHaveProperty('payment');
  });
});
