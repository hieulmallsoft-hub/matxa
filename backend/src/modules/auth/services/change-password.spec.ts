import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

describe('signed-in user changes their password', () => {
  const subject = async (identity: { id: string; passwordHash: string | null } | null = { id: 'identity-1', passwordHash: null }) => {
    const prisma: any = {
      userIdentity: { findFirst: jest.fn(), update: jest.fn() },
      session: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    prisma.$transaction = jest.fn((callback: any) => callback(prisma));
    const config = { get: (_key: string, fallback: unknown) => fallback, getOrThrow: () => 'a'.repeat(32) };
    const service = new AuthService({} as any, {} as any, prisma, {} as any, {} as any, {} as any, {} as any, config as any);
    if (identity && !identity.passwordHash) identity.passwordHash = await (service as any).hashPassword('old-password1');
    prisma.userIdentity.findFirst.mockResolvedValue(identity);
    return { service, prisma };
  };

  it('stores the new password and signs out every other session', async () => {
    const { service, prisma } = await subject();
    await expect(service.changePassword('user-1', 'session-1', 'old-password1', 'new-password1')).resolves.toEqual({ changed: true });

    expect(prisma.userIdentity.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', provider: 'EMAIL' },
      select: { id: true, passwordHash: true },
    });
    const { passwordHash } = prisma.userIdentity.update.mock.calls[0][0].data;
    expect(passwordHash).not.toContain('new-password1');
    await expect((service as any).verifyPassword('new-password1', passwordHash)).resolves.toBe(true);
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null, id: { not: 'session-1' } },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects a wrong current password without changing anything', async () => {
    const { service, prisma } = await subject();
    await expect(service.changePassword('user-1', 'session-1', 'wrong-password', 'new-password1')).rejects.toThrow(
      new BadRequestException('Mat khau hien tai khong dung'),
    );
    expect(prisma.userIdentity.update).not.toHaveBeenCalled();
    expect(prisma.session.updateMany).not.toHaveBeenCalled();
  });

  it('rejects reusing the current password', async () => {
    const { service } = await subject();
    await expect(service.changePassword('user-1', 'session-1', 'old-password1', 'old-password1')).rejects.toThrow(
      'Mat khau moi phai khac mat khau hien tai',
    );
  });

  it('rejects accounts that do not sign in with email and password', async () => {
    const { service } = await subject(null);
    await expect(service.changePassword('user-1', 'session-1', 'old-password1', 'new-password1')).rejects.toThrow(
      'Tai khoan khong dang nhap bang mat khau',
    );
  });
});
