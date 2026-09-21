import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UpdateProfileDto } from '../dto/profile.dto';
import { ProfileStorageService } from './profile-storage.service';

const profileSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
  gender: true,
  nationality: true,
  role: true,
} as const;

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ProfileStorageService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: profileSelect });
    if (!user) throw new NotFoundException('Khong tim thay tai khoan');
    return this.toProfile(user);
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const data: Record<string, string | undefined> = {
      displayName: dto.displayName?.trim(),
      gender: dto.gender,
      nationality: dto.nationality?.trim(),
    };
    if (dto.avatarKey !== undefined) {
      if (!dto.avatarKey.startsWith(`avatars/${userId}/`)) {
        throw new BadRequestException('Avatar key khong hop le');
      }
      data.avatarKey = dto.avatarKey;
      data.avatarUrl = this.storage.publicUrlFor(dto.avatarKey);
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: profileSelect,
    });
    return this.toProfile(user);
  }

  private toProfile(user: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    gender: string | null;
    nationality: string | null;
    role: string;
  }) {
    return {
      ...user,
      onboardingCompleted: Boolean(user.displayName && user.gender && user.nationality),
    };
  }
}
