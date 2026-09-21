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
  const storage = { publicUrlFor: jest.fn() };
  const service = new ProfileService(prisma as never, storage as never);

  beforeEach(() => jest.clearAllMocks());

  it('returns profile and completed onboarding status', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    await expect(service.getMe(user.id)).resolves.toEqual({ ...user, onboardingCompleted: true });
  });

  it('only accepts an avatar key belonging to the current user', async () => {
    await expect(service.updateMe(user.id, { avatarKey: 'avatars/another-user/file.jpg' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('saves the public avatar URL derived from the presigned upload key', async () => {
    const avatarKey = `avatars/${user.id}/file.jpg`;
    storage.publicUrlFor.mockReturnValue('https://cdn.example.com/' + avatarKey);
    prisma.user.update.mockResolvedValue({ ...user, avatarUrl: 'https://cdn.example.com/' + avatarKey });

    await service.updateMe(user.id, { avatarKey });

    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ avatarKey, avatarUrl: 'https://cdn.example.com/' + avatarKey }),
    }));
  });
});
