import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
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
  status: true,
  identities: { select: { provider: true, email: true, phoneNumber: true, emailVerified: true } },
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
    if (dto.displayName !== undefined && !dto.displayName.trim())
      throw new BadRequestException('Ten hien thi khong duoc de trong');
    const data: Record<string, string | undefined> = {
      displayName: dto.displayName?.trim(),
      gender: dto.gender,
      nationality: dto.nationality?.trim(),
    };
    const phoneNumber = dto.phoneNumber === undefined ? undefined : this.normalizePhoneNumber(dto.phoneNumber);
    if (phoneNumber) {
      const owner = await this.prisma.userIdentity.findFirst({
        where: { provider: 'PHONE', providerSubject: phoneNumber, userId: { not: userId } },
        select: { id: true },
      });
      if (owner) throw new ConflictException('So dien thoai da duoc lien ket voi tai khoan khac');
    }
    let previousKey: string | null = null;
    let savedKey: string | undefined;
    if (dto.avatarKey !== undefined) {
      const prefix = `avatars/${userId}/`;
      if (
        typeof dto.avatarKey !== 'string' ||
        !dto.avatarKey.startsWith(prefix) ||
        !/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(dto.avatarKey.slice(prefix.length))
      ) {
        throw new BadRequestException('Avatar key khong hop le');
      }
      const current = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarKey: true } });
      if (!current) throw new NotFoundException('Khong tim thay tai khoan');
      previousKey = current.avatarKey;
      savedKey = await this.storage.prepareAvatar(userId, dto.avatarKey);
      data.avatarKey = savedKey;
      data.avatarUrl = this.storage.publicUrlFor(savedKey);
    }

    let user;
    try {
      user = await this.prisma.user.update({
        where: { id: userId, ...(savedKey ? { avatarKey: previousKey } : {}) },
        data,
        select: profileSelect,
      });
    } catch (error) {
      if (savedKey) await this.storage.deleteAvatar(userId, savedKey);
      if (savedKey && (error as { code?: string }).code === 'P2025') {
        throw new ConflictException('Ho so da thay doi, vui long thu lai');
      }
      throw error;
    }
    if (phoneNumber) {
      const existingPhoneIdentity = await this.prisma.userIdentity.findFirst({
        where: { userId, provider: 'PHONE' },
        select: { id: true },
      });
      try {
        if (existingPhoneIdentity) {
          await this.prisma.userIdentity.update({
            where: { id: existingPhoneIdentity.id },
            data: { providerSubject: phoneNumber, phoneNumber, emailVerified: true },
          });
        } else {
          await this.prisma.userIdentity.create({
            data: { userId, provider: 'PHONE', providerSubject: phoneNumber, phoneNumber, emailVerified: true },
          });
        }
      } catch (error) {
        if ((error as { code?: string }).code === 'P2002')
          throw new ConflictException('So dien thoai da duoc lien ket voi tai khoan khac');
        throw error;
      }
    }
    if (savedKey) {
      await this.storage.deleteAvatar(userId, previousKey);
      await this.storage.deleteAvatar(userId, dto.avatarKey);
    }
    if (phoneNumber) return this.getMe(userId);
    return this.toProfile(user);
  }

  private normalizePhoneNumber(input: string) {
    const compact = input.trim().replace(/[\s().-]/g, '');
    const phone = parsePhoneNumberFromString(compact, 'VN');
    if (!phone?.isValid() || phone.country !== 'VN')
      throw new BadRequestException('So dien thoai Viet Nam khong hop le');
    return phone.number;
  }

  private toProfile(user: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    gender: string | null;
    nationality: string | null;
    role: string;
    status?: string;
    identities?: Array<{ provider: string; email: string | null; phoneNumber: string | null; emailVerified: boolean }>;
  }) {
    const emailIdentity = user.identities?.find((identity) => identity.email)?.email ?? null;
    const phoneIdentity = user.identities?.find((identity) => identity.provider === 'PHONE' && identity.phoneNumber);
    return {
      ...user,
      status: user.status ?? 'ACTIVE',
      email: emailIdentity,
      phone: phoneIdentity?.phoneNumber ?? null,
      phoneVerified: Boolean(phoneIdentity?.phoneNumber),
      onboardingCompleted: Boolean(user.displayName && user.gender && user.nationality),
    };
  }
}
