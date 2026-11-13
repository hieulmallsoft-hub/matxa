import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
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
import { buildRevenueReport, monthRanges, periodRanges, RevenuePeriod } from './revenue-report';

const number = (value: unknown) => Number(value ?? 0);

/** Promotion.code is unique; surface a readable 409 instead of a Prisma 500. */
const duplicatePromotionCode = (error: unknown): never => {
  if ((error as { code?: string })?.code === 'P2002') throw new ConflictException('Ma khuyen mai da ton tai');
  throw error;
};

@Injectable()
export class AdminMarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async revenueReport(period: RevenuePeriod = 'month', now = new Date()) {
    const months = monthRanges(now);
    const ranges = periodRanges(period, now);
    const from = new Date(Math.min(months.previous.start.getTime(), ranges.previous.start.getTime()));
    const to = new Date(Math.max(months.current.end.getTime(), ranges.current.end.getTime()));
    const finished = (range: { start: Date; end: Date }) =>
      this.prisma.booking.groupBy({
        by: ['status'],
        where: { status: { in: ['COMPLETED', 'CANCELLED', 'EXPIRED'] }, scheduledStart: { gte: range.start, lt: range.end } },
        _count: { _all: true },
      });
    const [total, completed, thisMonth, lastMonth] = await Promise.all([
      this.prisma.booking.aggregate({ where: { status: 'COMPLETED' }, _sum: { platformFee: true, totalAmount: true } }),
      this.prisma.booking.findMany({
        where: { status: 'COMPLETED', scheduledStart: { gte: from, lt: to } },
        select: {
          scheduledStart: true,
          totalAmount: true,
          platformFee: true,
          addressSnapshot: true,
          technicianId: true,
          technician: {
            select: { city: true, district: true, averageRating: true, user: { select: { displayName: true, avatarUrl: true } } },
          },
          items: { select: { serviceName: true, categoryName: true, durationMinutes: true } },
        },
      }),
      finished(months.current),
      finished(months.previous),
    ]);
    const byStatus = (rows: { status: string; _count: { _all: number } }[]) =>
      Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
    return buildRevenueReport({
      period,
      now,
      totalRevenue: number(total._sum.platformFee),
      totalOrderValue: number(total._sum.totalAmount),
      completed,
      finishedThisMonth: byStatus(thisMonth),
      finishedLastMonth: byStatus(lastMonth),
    });
  }

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
        _sum: { platformFee: true },
        _count: { id: true },
      }),
    ]);
    return {
      todayBookings,
      activeTechnicians: technicians,
      averageRating: number(review._avg.rating),
      reviewCount: review._count.rating,
      completedBookingsThisMonth: completedThisMonth._count.id,
      // The platform's revenue is its commission, as on the revenue report; the rest is the technician's.
      revenueThisMonth: number(completedThisMonth._sum.platformFee),
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
              ...(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search.trim())
                ? [{ id: search.trim() }] : []),
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
    const stats = await this.cancelStats(items.map((user) => user.id));
    return {
      items: items.map(({ identities, ...user }) => ({
        ...user,
        email: identities.find((identity) => identity.email)?.email ?? null,
        phoneNumber: identities.find((identity) => identity.phoneNumber)?.phoneNumber ?? null,
        providers: identities.map((identity) => identity.provider),
        cancellations: stats.get(user.id),
      })),
      total,
      page,
      limit,
    };
  }

  async updateUserStatus(adminId: string, userId: string, dto: UpdateUserStatusDto) {
    if (adminId === userId && dto.status !== 'ACTIVE')
      throw new BadRequestException('Khong the khoa tai khoan admin dang dang nhap');
    const blocking = dto.status === 'BLOCKED';
    const updated = await this.prisma.user.updateMany({
      where: { id: userId },
      data: { status: dto.status, blockedReason: blocking ? dto.reason!.trim() : null, blockedAt: blocking ? new Date() : null },
    });
    if (!updated.count) throw new NotFoundException('Khong tim thay nguoi dung');
    // Signed out everywhere at once; the apps then get 403 ACCOUNT_BLOCKED with the reason.
    if (blocking) await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, avatarUrl: true, role: true, status: true, blockedReason: true, blockedAt: true, updatedAt: true },
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
          applications: {
            orderBy: { createdAt: 'asc' },
            include: {
              technicianProfile: {
                select: { id: true, user: { select: { id: true, displayName: true, avatarUrl: true } } },
              },
            },
          },
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
        travelFee: number(booking.travelFee),
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
        applications: booking.applications.map((application) => ({
          applicationId: application.id,
          technicianId: application.technicianProfileId,
          displayName: application.technicianProfile?.user?.displayName ?? null,
          avatarUrl: application.technicianProfile?.user?.avatarUrl ?? null,
          status: application.status,
          isSelected: application.status === 'SELECTED',
          isApplicant: application.status === 'APPLIED',
          appliedAt: application.createdAt,
        })),
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
          user: { select: { id: true, displayName: true, avatarUrl: true, status: true, blockedReason: true } },
          _count: { select: { services: { where: { isActive: true } } } },
        },
      }),
      this.prisma.technicianProfile.count(),
    ]);
    const stats = await this.cancelStats(items.map((profile) => profile.userId));
    return {
      items: items.map((profile) => ({ ...profile, averageRating: number(profile.averageRating), cancellations: stats.get(profile.userId) })),
      total,
      page,
      limit,
    };
  }

  /**
   * Taken bookings each person cancelled (the ones counted toward the cancel limit): today and this month in Viet Nam
   * time, the last 7 days, and until when they are locked out by the cancel limit (null = not locked).
   */
  private async cancelStats(userIds: string[], now = new Date()) {
    const vnOffset = 7 * 3_600_000;
    const vn = new Date(now.getTime() + vnOffset);
    const today = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - vnOffset);
    const month = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), 1) - vnOffset);
    const week = new Date(now.getTime() - 7 * 86_400_000);
    const settings = new Map(
      (await this.prisma.systemSetting.findMany({
        where: { key: { in: ['BOOKING_CANCEL_LIMIT_COUNT', 'BOOKING_CANCEL_LIMIT_WINDOW_HOURS', 'BOOKING_CANCEL_LOCK_HOURS'] } },
      })).map((row) => [row.key, Number(row.value)]),
    );
    const limit = settings.get('BOOKING_CANCEL_LIMIT_COUNT') ?? 3;
    const windowStart = new Date(now.getTime() - (settings.get('BOOKING_CANCEL_LIMIT_WINDOW_HOURS') ?? 24) * 3_600_000);
    const lockMs = (settings.get('BOOKING_CANCEL_LOCK_HOURS') ?? 3) * 3_600_000;
    const since = new Date(Math.min(month.getTime(), week.getTime(), windowStart.getTime()));
    const rows = userIds.length
      ? await this.prisma.booking.findMany({
          where: { cancelledByUserId: { in: userIds }, cancelPenalized: true, cancelledAt: { gte: since } },
          select: { cancelledByUserId: true, cancelledAt: true },
        })
      : [];
    return new Map(
      userIds.map((userId) => {
        const times = rows.filter((row) => row.cancelledByUserId === userId).map((row) => row.cancelledAt!.getTime());
        const recent = times.filter((time) => time >= windowStart.getTime());
        const unlock = limit > 0 && recent.length >= limit ? Math.max(...recent) + lockMs : 0;
        return [
          userId,
          {
            today: times.filter((time) => time >= today.getTime()).length,
            week: times.filter((time) => time >= week.getTime()).length,
            month: times.filter((time) => time >= month.getTime()).length,
            lockedUntil: unlock > now.getTime() ? new Date(unlock) : null,
          },
        ];
      }),
    );
  }

  /** Every booking this person cancelled lately, for the admin to judge before blocking. */
  async userCancellations(userId: string, days = 30) {
    const bookings = await this.prisma.booking.findMany({
      where: { cancelledByUserId: userId, cancelledAt: { gte: new Date(Date.now() - days * 86_400_000) } },
      orderBy: { cancelledAt: 'desc' },
      take: 100,
      select: {
        id: true, mode: true, scheduledStart: true, cancelledAt: true, cancelledByRole: true, cancelPenalized: true,
        cancellationReasonCode: true, cancellationReasonText: true, totalAmount: true,
        customer: { select: { id: true, displayName: true } },
        technician: { select: { id: true, user: { select: { id: true, displayName: true } } } },
        cancellation: { select: { _count: { select: { evidence: true } } } },
        items: { select: { serviceName: true } },
      },
    });
    return bookings.map(({ cancellation, items, totalAmount, ...booking }) => ({
      ...booking,
      totalAmount: number(totalAmount),
      services: items.map((item) => item.serviceName),
      evidenceCount: cancellation?._count.evidence ?? 0,
    }));
  }

  async updateTechnician(id: string, dto: UpdateAdminTechnicianDto) {
    const before = await this.prisma.technicianProfile.findUnique({ where: { id }, select: { userId: true, isActive: true } });
    if (!before) throw new NotFoundException('Khong tim thay ky thuat vien');
    const { hiddenReason, ...data } = dto;
    const hiding = dto.isActive === false;
    const showing = dto.isActive === true;
    await this.prisma.technicianProfile.update({
      where: { id },
      data: { ...data, ...(hiding ? { hiddenReason: hiddenReason?.trim() || null } : showing ? { hiddenReason: null } : {}) },
    });
    // Tell the technician why they stopped getting jobs, and when they are back.
    if (hiding && before.isActive)
      await this.notifyTechnician(before.userId, 'TECHNICIAN_PROFILE_HIDDEN', 'Hồ sơ của bạn đang tạm ẩn',
        hiddenReason?.trim() ? `Lý do: ${hiddenReason.trim()}. Liên hệ CSKH nếu cần hỗ trợ.` : 'Khách tạm thời không thấy hồ sơ và bạn chưa nhận được đơn mới. Liên hệ CSKH nếu cần hỗ trợ.');
    if (showing && !before.isActive)
      await this.notifyTechnician(before.userId, 'TECHNICIAN_PROFILE_SHOWN', 'Hồ sơ của bạn đã hiển thị lại', 'Bạn có thể nhận đơn như bình thường.');
    return this.prisma.technicianProfile.findUnique({ where: { id } });
  }

  private async notifyTechnician(userId: string, type: string, title: string, body: string) {
    if (!this.notifications) return;
    const actionUrl = 'matxa://technician/profile';
    try {
      await this.notifications.create(userId, type, title, body, actionUrl);
      await this.notifications.sendPush(userId, title, body, { type, actionUrl });
    } catch {
      // The change is saved; a failed notification must not undo it.
    }
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
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.technicianServicePriceOption.updateMany({
        where: { id: optionId, technicianServiceId: serviceId, technicianService: { technicianId } },
        data: { price: dto.price },
      });
      if (!updated.count) throw new NotFoundException('Khong tim thay goi gia cua ky thuat vien');
      // Keep the service's starting price aligned with its first active option, as the technician's own edit does.
      const primary = await tx.technicianServicePriceOption.findFirst({
        where: { technicianServiceId: serviceId, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { durationMinutes: 'asc' }],
      });
      if (primary)
        await tx.technicianService.update({
          where: { id: serviceId },
          data: { durationMinutes: primary.durationMinutes, price: primary.price },
        });
      const option = await tx.technicianServicePriceOption.findUnique({ where: { id: optionId } });
      return option && { ...option, price: number(option.price) };
    });
  }

  categories() {
    return this.prisma.serviceCategory.findMany({
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }
  /** People who cancelled taken bookings (counted toward the cancel limit) at least `minCancellations` times lately. */
  async cancelOffenders(days = 7, minCancellations = 3) {
    const since = new Date(Date.now() - days * 86_400_000);
    const groups = await this.prisma.booking.groupBy({
      by: ['cancelledByUserId'],
      where: { cancelPenalized: true, cancelledAt: { gte: since }, cancelledByUserId: { not: null } },
      _count: { _all: true },
      _max: { cancelledAt: true },
    });
    const offenders = groups.filter((group) => group._count._all >= minCancellations);
    const users = await this.prisma.user.findMany({
      where: { id: { in: offenders.map((group) => group.cancelledByUserId!) } },
      select: { id: true, displayName: true, role: true, status: true },
    });
    return offenders
      .map((group) => ({
        user: users.find((user) => user.id === group.cancelledByUserId) ?? null,
        cancellations: group._count._all,
        lastCancelledAt: group._max.cancelledAt,
      }))
      .sort((a, b) => b.cancellations - a.cancellations);
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
    // customerIds is not a Promotion column; it maps to the recipients relation.
    const { customerIds, ...promotion } = dto;
    return this.prisma.promotion.create({
      data: {
        ...promotion,
        code: dto.code.trim().toUpperCase(),
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        ...(customerIds?.length ? { recipients: { create: customerIds.map((userId) => ({ userId })) } } : {}),
      },
    }).catch(duplicatePromotionCode);
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
    const { customerIds, ...promotion } = dto;
    return this.prisma.promotion.update({
      where: { id },
      data: {
        ...promotion,
        // An explicit list replaces recipients; an empty list makes the voucher public again.
        ...(customerIds
          ? { recipients: { deleteMany: {}, create: customerIds.map((userId) => ({ userId })) } }
          : {}),
        ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.startsAt ? { startsAt: new Date(dto.startsAt) } : {}),
        ...(dto.endsAt ? { endsAt: new Date(dto.endsAt) } : {}),
      },
    }).catch(duplicatePromotionCode);
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
