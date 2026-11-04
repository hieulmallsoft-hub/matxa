import { BookingsService } from './bookings.service';

// Regression: the commission was charged before the booking was assigned, so the
// "booking belongs to this technician" check inside the charge always failed with 403.
describe('assigning an open booking charges the chosen technician', () => {
  const subject = () => {
    const state = { technicianId: null as string | null, status: 'OPEN', balance: 1_000_000, ledger: [] as any[] };
    const tx: any = {
      booking: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn(async () => ({ id: 'booking-1', status: state.status, items: [] })),
        // Mirrors Prisma: the relation filter only matches once technicianId is set.
        findFirst: jest.fn(async ({ where }: any) =>
          where.technician?.userId === 'fftools-user' && state.technicianId === 'fftools-profile'
            ? { grossServiceAmount: 800000 }
            : null),
        update: jest.fn(async ({ data }: any) => {
          if (data.technicianId) state.technicianId = data.technicianId;
          if (data.status) state.status = data.status;
          return { id: 'booking-1', technicianId: state.technicianId, status: state.status, items: [] };
        }),
      },
      bookingTechnicianApplication: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'fftools-application', technicianProfileId: 'fftools-profile',
          technicianProfile: { user: { id: 'fftools-user' } },
        }),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([{ technicianProfile: { userId: 'duc-user' } }]),
      },
      wallet: {
        upsert: jest.fn().mockResolvedValue({ id: 'wallet-1' }),
        updateMany: jest.fn(async ({ data }: any) => {
          state.balance -= data.balanceVnd.decrement;
          return { count: 1 };
        }),
        findUniqueOrThrow: jest.fn(async () => ({ balanceVnd: state.balance })),
      },
      walletLedgerEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: any) => state.ledger.push(data)),
      },
    };
    const prisma: any = { $transaction: jest.fn((callback: any) => callback(tx)) };
    const service: any = new BookingsService(
      prisma, { get: (_key: string, fallback: unknown) => fallback } as any, {} as any, {} as any,
    );
    jest.spyOn(service, 'assertOpenEligibility').mockResolvedValue(undefined);
    jest.spyOn(service, 'notifyStatus').mockResolvedValue(undefined);
    return { service, state };
  };

  it('lets the customer pick a fallback technician and charges that technician the commission', async () => {
    const { service, state } = subject();
    await expect(service.selectTechnician('customer-1', 'booking-1', 'fftools-application')).resolves.toMatchObject({
      bookingStatus: 'CONFIRMED',
    });
    expect(state.technicianId).toBe('fftools-profile');
    expect(state.ledger).toEqual([expect.objectContaining({ type: 'COMMISSION_DEBIT', amountVnd: -200000 })]);
  });

  it('tells the customer to pick someone else, not about the technician wallet, when the charge fails', async () => {
    const { service, state } = subject();
    state.balance = 1000;
    jest.spyOn(service, 'chargeTechnicianCommission').mockRejectedValue(
      new (require('@nestjs/common').ConflictException)('So du vi khong du de nhan don'),
    );
    await expect(service.selectTechnician('customer-1', 'booking-1', 'fftools-application')).rejects.toThrow(
      'KTV nay hien khong nhan duoc don, vui long chon KTV khac',
    );
  });
});
