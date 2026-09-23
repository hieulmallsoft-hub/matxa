import { BadRequestException } from '@nestjs/common';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    displayName: 'Thu Huong',
    avatarUrl: null,
    gender: 'FEMALE',
    nationality: 'Việt Nam',
    role: 'CUSTOMER',
  };
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const storage = { publicUrlFor: jest.fn(), prepareAvatar: jest.fn(), deleteAvatar: jest.fn() };
  const service = new ProfileService(prisma as never, storage as never);

  beforeEach(() => jest.resetAllMocks());

  it('returns profile and completed onboarding status', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    await expect(service.getMe(user.id)).resolves.toEqual({ ...user, onboardingCompleted: true });
  });

  it('only accepts an avatar key belonging to the current user', async () => {
    await expect(service.updateMe(user.id, { avatarKey: 'avatars/another-user/file.jpg' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('saves the public avatar URL derived from the presigned upload key', async () => {
    const avatarKey = `avatars/${user.id}/${user.id}.jpg`;
    prisma.user.findUnique.mockResolvedValue({ avatarKey: null });
    storage.prepareAvatar.mockResolvedValue(avatarKey);
    storage.publicUrlFor.mockReturnValue('https://cdn.example.com/' + avatarKey);
    prisma.user.update.mockResolvedValue({ ...user, avatarUrl: 'https://cdn.example.com/' + avatarKey });

    await service.updateMe(user.id, { avatarKey });

    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ avatarKey, avatarUrl: 'https://cdn.example.com/' + avatarKey }),
    }));
  });

  it('does not update the profile when the uploaded object is missing', async () => {
    prisma.user.findUnique.mockResolvedValue({ avatarKey: 'old' });
    storage.prepareAvatar.mockRejectedValue(new BadRequestException());
    await expect(service.updateMe(user.id, { avatarKey: `avatars/${user.id}/${user.id}.jpg` })).rejects.toThrow();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(storage.deleteAvatar).not.toHaveBeenCalled();
  });

  it('deletes the old image only after the conditional profile update succeeds', async () => {
    const old = `avatars/${user.id}/saved/old.jpg`;
    prisma.user.findUnique.mockResolvedValue({ avatarKey: old });
    storage.prepareAvatar.mockResolvedValue('saved-new');
    prisma.user.update.mockResolvedValue(user);
    await service.updateMe(user.id, { avatarKey: `avatars/${user.id}/${user.id}.jpg` });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: user.id, avatarKey: old } }));
    expect(storage.deleteAvatar).toHaveBeenCalledWith(user.id, old);
    expect(storage.deleteAvatar.mock.invocationCallOrder[0]).toBeGreaterThan(prisma.user.update.mock.invocationCallOrder[0]);
  });

  it('cleans only the new copy if a concurrent update wins', async () => {
    prisma.user.findUnique.mockResolvedValue({ avatarKey: 'old' });
    storage.prepareAvatar.mockResolvedValue('saved-new');
    prisma.user.update.mockRejectedValue({ code: 'P2025' });
    await expect(service.updateMe(user.id, { avatarKey: `avatars/${user.id}/${user.id}.jpg` })).rejects.toMatchObject({ status: 409 });
    expect(storage.deleteAvatar).toHaveBeenCalledTimes(1);
    expect(storage.deleteAvatar).toHaveBeenCalledWith(user.id, 'saved-new');
  });

  it('rejects null and previously saved keys', async () => {
    for (const avatarKey of [null, `avatars/${user.id}/saved/${user.id}.jpg`]) {
      await expect(service.updateMe(user.id, { avatarKey } as never)).rejects.toBeInstanceOf(BadRequestException);
    }
  });
});
