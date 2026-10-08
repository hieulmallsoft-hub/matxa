import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  AdminBookingsQueryDto,
  AdminPageDto,
  AdminUsersQueryDto,
  CreateBannerDto,
  CreateCategoryDto,
  CreatePromotionDto,
  CreateTechnicianByAdminDto,
  UpdateAdminTechnicianDto,
  UpdateBannerDto,
  UpdateAdminTechnicianPriceOptionDto,
  UpdateCategoryDto,
  UpdatePromotionDto,
  UpdateUserStatusDto,
} from '../dto/marketplace.dto';

const number = (value: unknown) => Number(value ?? 0);

@Injectable()
export class AdminMarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const [todayBookings, technicians, review, completedThisMonth] = await Promise.all([
      this.prisma.booking.count({ where: { scheduledStart: { gte: todayStart, lt: tomorrowStart } } }),
      this.prisma.technicianProfile.count({ where: { isActive: true, isVerified: true, user: { status: 'ACTIVE' } } }),
      this.prisma.review.aggregate({ _avg: { rating: true }, _count: { rating: true } }),
      this.prisma.booking.aggregate({
        where: { status: 'COMPLETED', scheduledStart: { gte: monthStart, lt: nextMonthStart } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
    ]);
    return {
      todayBookings,
      activeTechnicians: technicians,
      averageRating: number(review._avg.rating),
      reviewCount: review._count.rating,
      completedBookingsThisMonth: completedThisMonth._count.id,
      revenueThisMonth: number(completedThisMonth._sum.totalAmount),
    };
  }

  async users(query: AdminUsersQueryDto) {
    const { page, limit, search, role, status } = query;
    const where = {
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
      ...(search?.trim()
        ? {
            OR: [
              { displayName: { contains: search.trim(), mode: 'insensitive' as const } },
              { identities: { some: { email: { contains: search.trim(), mode: 'insensitive' as const } } } },
              { identities: { some: { phoneNumber: { contains: search.trim() } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          identities: { select: { provider: true, email: true, phoneNumber: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map(({ identities, ...user }) => ({
        ...user,
        email: identities.find((identity) => identity.email)?.email ?? null,
        phoneNumber: identities.find((identity) => identity.phoneNumber)?.phoneNumber ?? null,
        providers: identities.map((identity) => identity.provider),
      })),
      total,
      page,
      limit,
    };
  }

  async updateUserStatus(adminId: string, userId: string, dto: UpdateUserStatusDto) {
    if (adminId === userId && dto.status !== 'ACTIVE')
      throw new BadRequestException('Khong the khoa tai khoan admin dang dang nhap');
    const updated = await this.prisma.user.updateMany({ where: { id: userId }, data: { status: dto.status } });
    if (!updated.count) throw new NotFoundException('Khong tim thay nguoi dung');
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, avatarUrl: true, role: true, status: true, updatedAt: true },
    });
  }

  async bookings(query: AdminBookingsQueryDto) {
    const { page, limit, status } = query;
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { scheduledStart: 'desc' },
        include: {
          customer: { select: { id: true, displayName: true, avatarUrl: true } },
          technician: { select: { id: true, user: { select: { id: true, displayName: true, avatarUrl: true } } } },
          items: { select: { id: true, serviceId: true, serviceName: true, durationMinutes: true, unitPrice: true } },
          payment: { select: { method: true, status: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return {
      items: items.map((booking) => ({
        ...booking,
        subtotal: number(booking.subtotal),
        serviceFee: number(booking.serviceFee),
        discountAmount: number(booking.discountAmount),
        totalAmount: number(booking.totalAmount),
        financials: {
          grossServiceAmount: booking.grossServiceAmount === null ? null : number(booking.grossServiceAmount),
          platformFee: booking.platformFee === null ? null : number(booking.platformFee),
          technicianEarning: booking.technicianEarning === null ? null : number(booking.technicianEarning),
          customerPayableAmount: booking.customerPayableAmount === null ? null : number(booking.customerPayableAmount),
          feePolicyVersion: booking.feePolicyVersion,
          currency: 'VND',
        },
        items: booking.items.map((item) => ({ ...item, unitPrice: number(item.unitPrice) })),
      })),
      total,
      page,
      limit,
    };
  }

  async technicians(query: AdminPageDto) {
    const { page, limit } = query;
    const [items, total] = await Promise.all([
      this.prisma.technicianProfile.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true, status: true } },
          _count: { select: { services: { where: { isActive: true } } } },
        },
      }),
      this.prisma.technicianProfile.count(),
    ]);
    return {
      items: items.map((profile) => ({ ...profile, averageRating: number(profile.averageRating) })),
      total,
      page,
      limit,
    };
  }

  async updateTechnician(id: string, dto: UpdateAdminTechnicianDto) {
    const updated = await this.prisma.technicianProfile.updateMany({ where: { id }, data: dto });
    if (!updated.count) throw new NotFoundException('Khong tim thay ky thuat vien');
    return this.prisma.technicianProfile.findUnique({ where: { id } });
  }

  async technicianServices(id: string) {
    const technician = await this.prisma.technicianProfile.findUnique({
      where: { id },
      select: {
        id: true,
        user: { select: { displayName: true } },
        services: {
          orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
          include: {
            category: { select: { id: true, name: true, slug: true } },
            priceOptions: { orderBy: [{ durationMinutes: 'asc' }, { sortOrder: 'asc' }] },
          },
        },
      },
    });
    if (!technician) throw new NotFoundException('Khong tim thay ky thuat vien');
    return {
      ...technician,
      services: technician.services.map((service) => ({
        ...service,
        price: number(service.price),
        priceOptions: service.priceOptions.map((option) => ({ ...option, price: number(option.price) })),
      })),
    };
  }

  async updateTechnicianPriceOption(
    technicianId: string,
    serviceId: string,
    optionId: string,
    dto: UpdateAdminTechnicianPriceOptionDto,
  ) {
    const updated = await this.prisma.technicianServicePriceOption.updateMany({
      where: { id: optionId, technicianServiceId: serviceId, technicianService: { technicianId } },
      data: { price: dto.price },
    });
    if (!updated.count) throw new NotFoundException('Khong tim thay goi gia cua ky thuat vien');
    const option = await this.prisma.technicianServicePriceOption.findUnique({ where: { id: optionId } });
    return option && { ...option, price: number(option.price) };
  }

  categories() {
    return this.prisma.serviceCategory.findMany({
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }
  createCategory(_adminId: string, dto: CreateCategoryDto) {
    return this.prisma.serviceCategory.create({ data: dto });
  }
  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const updated = await this.prisma.serviceCategory.updateMany({ where: { id }, data: dto });
    if (!updated.count) throw new NotFoundException('Khong tim thay danh muc');
    return this.prisma.serviceCategory.findUnique({ where: { id } });
  }
  async deactivateCategory(id: string) {
    const updated = await this.prisma.serviceCategory.updateMany({ where: { id }, data: { isActive: false } });
    if (!updated.count) throw new NotFoundException('Khong tim thay danh muc');
  }

  createBanner(_adminId: string, dto: CreateBannerDto) {
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : undefined;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : undefined;
    this.validateDates(startsAt, endsAt, 'Thoi gian banner khong hop le');
    return this.prisma.homeBanner.create({ data: { ...dto, startsAt, endsAt } });
  }
  banners() {
    return this.prisma.homeBanner.findMany({ orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }] });
  }
  async updateBanner(id: string, dto: UpdateBannerDto) {
    const current = await this.prisma.homeBanner.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Khong tim thay banner');
    const startsAt = dto.startsAt === undefined ? current.startsAt : new Date(dto.startsAt);
    const endsAt = dto.endsAt === undefined ? current.endsAt : new Date(dto.endsAt);
    this.validateDates(startsAt, endsAt, 'Thoi gian banner khong hop le');
    return this.prisma.homeBanner.update({ where: { id }, data: { ...dto, startsAt, endsAt } });
  }
  async removeBanner(id: string) {
    const deleted = await this.prisma.homeBanner.deleteMany({ where: { id } });
    if (!deleted.count) throw new NotFoundException('Khong tim thay banner');
  }

  createPromotion(_adminId: string, dto: CreatePromotionDto) {
    this.validatePromotion(dto);
    return this.prisma.promotion.create({
      data: {
        ...dto,
        code: dto.code.trim().toUpperCase(),
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
      },
    });
  }
  promotions() {
    return this.prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
  }
  async updatePromotion(id: string, dto: UpdatePromotionDto) {
    const current = await this.prisma.promotion.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Khong tim thay khuyen mai');
    this.validatePromotion({
      ...current,
      ...dto,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : current.startsAt,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : current.endsAt,
      value: dto.value ?? number(current.value),
    });
    return this.prisma.promotion.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.startsAt ? { startsAt: new Date(dto.startsAt) } : {}),
        ...(dto.endsAt ? { endsAt: new Date(dto.endsAt) } : {}),
      },
    });
  }

  async createTechnician(_adminId: string, dto: CreateTechnicianByAdminDto) {
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

  private validateDates(startsAt: Date | null | undefined, endsAt: Date | null | undefined, message: string) {
    if (startsAt && endsAt && endsAt <= startsAt) throw new BadRequestException(message);
  }
  private validatePromotion(dto: { startsAt: Date | string; endsAt: Date | string; type: string; value: number }) {
    if (new Date(dto.endsAt) <= new Date(dto.startsAt))
      throw new BadRequestException('Thoi gian khuyen mai khong hop le');
    if (dto.type === 'PERCENT' && dto.value > 100)
      throw new BadRequestException('Phan tram khuyen mai khong duoc qua 100');
  }
}
