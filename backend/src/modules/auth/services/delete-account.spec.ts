import { BadRequestException, ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';

jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

describe('user deletes their account', () => {
  const subject = async (options: { password?: boolean; activeBookings?: number; walletVnd?: number } = {}) => {
    const prisma: any = {
      user: { findUnique: jest.fn(), update: jest.fn().mockReturnValue('anonymise') },
      booking: { count: jest.fn().mockResolvedValue(options.activeBookings ?? 0) },
      userIdentity: { deleteMany: jest.fn().mockReturnValue('release-sign-ins') },
      session: { updateMany: jest.fn().mockReturnValue('sign-out') },
      deviceToken: { deleteMany: jest.fn().mockReturnValue('stop-pushes') },
      address: { updateMany: jest.fn().mockReturnValue('drop-addresses') },
      favorite: { deleteMany: jest.fn().mockReturnValue('drop-favorites') },
      technicianProfile: { updateMany: jest.fn().mockReturnValue('hide-technician') },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const config = { get: (_key: string, fallback: unknown) => fallback, getOrThrow: () => 'a'.repeat(32) };
    const service = new AuthService({} as any, {} as any, prisma, {} as any, {} as any, {} as any, {} as any, config as any);
    const passwordHash = options.password ? await (service as any).hashPassword('secret-pass1') : null;
    prisma.user.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      identities: [{ provider: options.password ? 'EMAIL' : 'GOOGLE', passwordHash }],
      wallets: options.walletVnd ? [{ balanceVnd: options.walletVnd }] : [],
    });
    return { service, prisma };
  };

  it('anonymises the account, frees its sign-ins and signs out everywhere', async () => {
    const { service, prisma } = await subject();
    await expect(service.deleteAccount('user-1')).resolves.toEqual({ deleted: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({ status: 'DELETED', displayName: 'Tài khoản đã xóa', avatarUrl: null }),
    });
    expect(prisma.userIdentity.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      'anonymise', 'release-sign-ins', 'sign-out', 'stop-pushes', 'drop-addresses', 'drop-favorites', 'hide-technician',
    ]);
  });

  it('asks an email account for its password', async () => {
    const { service, prisma } = await subject({ password: true });
    await expect(service.deleteAccount('user-1')).rejects.toThrow(new BadRequestException('Mat khau khong dung'));
    await expect(service.deleteAccount('user-1', 'wrong')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    await expect(service.deleteAccount('user-1', 'secret-pass1')).resolves.toEqual({ deleted: true });
  });

  it('refuses while a booking is still running', async () => {
    const { service, prisma } = await subject({ activeBookings: 2 });
    const error = await service.deleteAccount('user-1').catch((caught) => caught);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toMatchObject({ code: 'ACTIVE_BOOKINGS', activeBookings: 2 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses while the technician wallet still holds money', async () => {
    const { service } = await subject({ walletVnd: 52_000 });
    const error = await service.deleteAccount('user-1').catch((caught) => caught);
    expect(error.getResponse()).toMatchObject({ code: 'WALLET_NOT_EMPTY', walletBalanceVnd: 52_000 });
  });
});
