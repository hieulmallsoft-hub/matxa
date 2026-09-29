import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const user = { findFirst: jest.fn() };
  const guard = new RolesGuard(reflector as never, { user } as never);
  const context = (auth?: { sub: string }) => ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ auth }) }),
  }) as unknown as ExecutionContext;

  beforeEach(() => jest.clearAllMocks());

  it('does nothing for routes without role metadata', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(context({ sub: 'customer' }))).resolves.toBe(true);
    expect(user.findFirst).not.toHaveBeenCalled();
  });

  it.each(['CUSTOMER', 'TECHNICIAN'])('rejects an active %s from an ADMIN route', async (role) => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    user.findFirst.mockResolvedValue({ role });
    await expect(guard.canActivate(context({ sub: 'user' }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an active ADMIN and reads role/status from the database', async () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    user.findFirst.mockResolvedValue({ role: 'ADMIN' });
    await expect(guard.canActivate(context({ sub: 'admin' }))).resolves.toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
    expect(user.findFirst).toHaveBeenCalledWith({ where: { id: 'admin', status: 'ACTIVE' }, select: { role: true } });
  });

  it('rejects a deactivated account even if its old token is still valid', async () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    user.findFirst.mockResolvedValue(null);
    await expect(guard.canActivate(context({ sub: 'admin' }))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
