import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateBannerDto, CreateCategoryDto, CreatePromotionDto, CreateTechnicianByAdminDto } from '../dto/marketplace.dto';

@Injectable()
export class AdminMarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async createCategory(adminId: string, dto: CreateCategoryDto) {
    await this.admin(adminId);
    return this.prisma.serviceCategory.create({ data: dto });
  }

  async createBanner(adminId: string, dto: CreateBannerDto) {
    await this.admin(adminId);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : undefined;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : undefined;
    if (startsAt && endsAt && endsAt <= startsAt) throw new BadRequestException('Thoi gian banner khong hop le');
    return this.prisma.homeBanner.create({ data: { ...dto, startsAt, endsAt } });
  }

  async createPromotion(adminId: string, dto: CreatePromotionDto) {
    await this.admin(adminId);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) throw new BadRequestException('Thoi gian khuyen mai khong hop le');
    if (dto.type === 'PERCENT' && dto.value > 100) throw new BadRequestException('Phan tram khuyen mai khong duoc qua 100');
    return this.prisma.promotion.create({ data: { ...dto, code: dto.code.trim().toUpperCase(), startsAt, endsAt } });
  }

  async createTechnician(adminId: string, dto: CreateTechnicianByAdminDto) {
    await this.admin(adminId);
    const { userId, ...profile } = dto;
    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { role: 'TECHNICIAN' } });
      return tx.technicianProfile.upsert({
        where: { userId },
        create: { userId, ...profile, isVerified: true },
        update: { ...profile, isVerified: true },
      });
    });
  }

  private async admin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (user?.role !== 'ADMIN') throw new ForbiddenException('Chi admin moi co quyen thuc hien');
  }
}
