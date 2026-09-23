import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { loadBookableServices } from '../../marketplace/services/technician-selection';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { CancelBookingDto, CreateBookingDto, CreateReviewDto, QuoteBookingDto, UpdateBookingStatusDto } from '../dto/booking.dto';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async quote(userId: string, dto: QuoteBookingDto, db: Prisma.TransactionClient = this.prisma) {
    const services = await loadBookableServices(db, dto.technicianId, dto.serviceIds, dto.mode);
    const durationMinutes = services.reduce((sum, item) => sum + item.durationMinutes, 0);
    const scheduledStart = new Date(dto.scheduledStart);
    const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60_000);
    if (!Number.isFinite(scheduledStart.getTime()) || scheduledStart <= new Date()) throw new BadRequestException('Thoi gian dat lich phai o tuong lai');
    const slot = await db.availabilitySlot.findFirst({
      where: { technicianId: dto.technicianId, isAvailable: true, startAt: { lte: scheduledStart }, endAt: { gte: scheduledEnd } },
    });
    if (!slot) throw new BadRequestException('Ky thuat vien khong ranh trong khung gio nay');
    const conflict = await db.booking.findFirst({
      where: { technicianId: dto.technicianId, status: { in: ['PENDING', 'CONFIRMED'] }, scheduledStart: { lt: scheduledEnd }, scheduledEnd: { gt: scheduledStart } },
      select: { id: true },
    });
    if (conflict) throw new BadRequestException('Khung gio da co nguoi dat');
    let addressSnapshot: { id: string; addressText: string; address: string; latitude: number; longitude: number; label: string | null } | null = null;
    if (dto.mode === 'HOME') {
      if (!dto.addressId) throw new BadRequestException('Dat tai nha can chon dia chi');
      const address = await db.address.findFirst({ where: { id: dto.addressId, userId, deletedAt: null },
        select: { id: true, address: true, latitude: true, longitude: true, label: true } });
      if (!address) throw new BadRequestException('Dia chi khong hop le');
      addressSnapshot = { id: address.id, addressText: address.address, address: address.address,
        latitude: Number(address.latitude), longitude: Number(address.longitude), label: address.label };
    }
    const subtotal = services.reduce((sum, item) => sum.plus(item.price), new Prisma.Decimal(0)).toNumber();
    const serviceFee = dto.mode === 'HOME' ? Number(this.config.get('HOME_SERVICE_FEE', 100000)) : 0;
    if (!Number.isFinite(serviceFee) || serviceFee < 0) throw new BadRequestException('Phi dich vu chua duoc cau hinh hop le');
    const promotion = dto.promotionCode ? await this.validPromotion(userId, dto.promotionCode, subtotal, db) : null;
    const discountAmount = promotion ? this.discount(promotion, subtotal) : 0;
    return {
      technicianId: dto.technicianId,
      services: services.map((item) => ({ id: item.id, serviceId: item.id, technicianServiceId: item.id, name: item.name, durationMinutes: item.durationMinutes, price: Number(item.price) })),
      mode: dto.mode,
      scheduledStart,
      scheduledEnd,
      durationMinutes,
      totalDuration: durationMinutes,
      startAt: scheduledStart, endAt: scheduledEnd, serviceMode: dto.mode,
      addressSnapshot,
      subtotal,
      serviceFee,
      promotionId: promotion?.id ?? null,
      promotionCode: promotion?.code ?? null,
      discountAmount,
      totalAmount: Prisma.Decimal.max(0, new Prisma.Decimal(subtotal).plus(serviceFee).minus(discountAmount)).toNumber(),
    };
  }

  async create(userId: string, dto: CreateBookingDto) {
    if (dto.paymentMethod !== 'CASH') throw new BadRequestException('Thanh toan online chua duoc ho tro');
    const phone = await this.prisma.userIdentity.findFirst({
      where: { userId, provider: 'PHONE', phoneNumber: { not: null } }, select: { id: true },
    });
    if (!phone) throw new ForbiddenException({
      statusCode: 403, code: 'PHONE_VERIFICATION_REQUIRED',
      message: 'Vui long xac thuc so dien thoai truoc khi dat dich vu',
    });
    try {
      const booking = await this.prisma.$transaction(async (tx) => {
        // Same domain/pricing validation as quote, re-run inside the write transaction.
        const quote = await this.quote(userId, dto, tx);
        const created = await tx.booking.create({
          data: {
            customerId: userId,
            technicianId: dto.technicianId,
            addressId: dto.mode === 'HOME' ? dto.addressId : null,
            addressSnapshot: quote.addressSnapshot ?? Prisma.DbNull,
            promotionId: quote.promotionId,
            mode: dto.mode,
            scheduledStart: quote.scheduledStart,
            scheduledEnd: quote.scheduledEnd,
            subtotal: quote.subtotal,
            serviceFee: quote.serviceFee,
            discountAmount: quote.discountAmount,
            totalAmount: quote.totalAmount,
            note: dto.note,
            items: { create: quote.services.map((item) => ({ serviceId: item.id, serviceName: item.name, durationMinutes: item.durationMinutes, unitPrice: item.price })) },
            payment: { create: { method: dto.paymentMethod, status: dto.paymentMethod === 'CASH' ? 'UNPAID' : 'PENDING', amount: quote.totalAmount } },
            ...(quote.promotionId ? { promotionUsage: { create: { promotionId: quote.promotionId, userId } } } : {}),
          },
          include: { items: true, payment: true, technician: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } }, address: true },
        });
        if (quote.promotionId) await tx.promotion.update({ where: { id: quote.promotionId }, data: { usedCount: { increment: 1 } } });
        return created;
      }, { isolationLevel: 'Serializable' });
      this.notifyBookingCreated(userId, booking.technician.userId, booking.id).catch(() => undefined);
      return this.withHistoricalAddress(booking);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if ((error as { code?: string })?.code === 'P2034') throw new ConflictException('Du lieu dat lich vua thay doi, vui long thu lai');
      if (error instanceof Error && (error.message.includes('bookings_no_active_overlap') || error.message.includes('could not serialize'))) {
        throw new BadRequestException('Khung gio vua duoc nguoi khac dat, vui long chon gio khac');
      }
      throw error;
    }
  }

  async listMine(userId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: { OR: [{ customerId: userId }, { technician: { userId } }] },
      include: { items: true, payment: true, customer: { select: { id: true, displayName: true, avatarUrl: true } }, technician: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } }, review: true },
      orderBy: { scheduledStart: 'desc' },
    });
    return bookings.map((booking) => this.withHistoricalAddress(booking));
  }

  async detail(userId: string, id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { items: true, payment: true, address: true, promotion: true, review: true, customer: { select: { id: true, displayName: true, avatarUrl: true, role: true } }, technician: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
    });
    if (!booking) throw new NotFoundException('Lich dat khong ton tai');
    const actor = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (booking.customerId !== userId && booking.technician.userId !== userId && actor?.role !== 'ADMIN') throw new ForbiddenException('Ban khong co quyen xem lich dat');
    return this.withHistoricalAddress(booking);
  }

  async cancel(userId: string, id: string, dto: CancelBookingDto) {
    const booking = await this.detail(userId, id);
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) throw new BadRequestException('Lich dat khong the huy');
    const updated = await this.transition(id, booking.status, { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: dto.reason });
    const target = booking.customerId === userId ? booking.technician.userId : booking.customerId;
    void this.notifyStatus(target, id, 'BOOKING_CANCELLED', 'Lich hen da huy', 'Mot lich hen da duoc huy.');
    return updated;
  }

  async updateStatus(userId: string, id: string, dto: UpdateBookingStatusDto) {
    const booking = await this.detail(userId, id);
    if (booking.technician.userId !== userId) throw new ForbiddenException('Chi ky thuat vien moi co the cap nhat trang thai');
    const allowed = (booking.status === 'PENDING' && dto.status === 'CONFIRMED') || (booking.status === 'CONFIRMED' && dto.status === 'COMPLETED');
    if (!allowed) throw new BadRequestException('Chuyen trang thai khong hop le');
    if (dto.status === 'COMPLETED' && booking.scheduledEnd > new Date()) {
      throw new BadRequestException('Chua den gio ket thuc dich vu');
    }
    const updated = await this.transition(id, booking.status, { status: dto.status });
    const title = dto.status === 'CONFIRMED' ? 'Dat lich thanh cong' : 'Dich vu da hoan thanh';
    void this.notifyStatus(booking.customerId, id, `BOOKING_${dto.status}`, title, title);
    return updated;
  }

  async review(userId: string, id: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findFirst({ where: { id, customerId: userId }, include: { review: true } });
    if (!booking) throw new NotFoundException('Lich dat khong ton tai');
    if (booking.status !== 'COMPLETED') throw new BadRequestException('Chi danh gia sau khi hoan thanh dich vu');
    if (booking.review) throw new BadRequestException('Lich dat da duoc danh gia');
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
      const review = await tx.review.create({ data: { bookingId: id, userId, technicianId: booking.technicianId, rating: dto.rating, comment: dto.comment } });
      const aggregate = await tx.review.aggregate({ where: { technicianId: booking.technicianId }, _avg: { rating: true }, _count: true });
      await tx.technicianProfile.update({ where: { id: booking.technicianId }, data: { averageRating: aggregate._avg.rating ?? 0, reviewCount: aggregate._count } });
      return review;
        }, { isolationLevel: 'Serializable' });
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code === 'P2002') throw new BadRequestException('Lich dat da duoc danh gia');
        if (code !== 'P2034') throw error;
        if (attempt === 2) throw new ConflictException('Danh gia dang duoc cap nhat, vui long thu lai');
      }
    }
  }

  private async transition(
    id: string,
    expectedStatus: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED',
    data: { status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'; cancelledAt?: Date; cancellationReason?: string },
  ) {
    try {
      return await this.prisma.booking.update({ where: { id, status: expectedStatus }, data });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2025') {
        throw new ConflictException('Trang thai lich dat da thay doi, vui long tai lai');
      }
      throw error;
    }
  }

  private withHistoricalAddress<T extends { addressSnapshot: Prisma.JsonValue; mode: string }>(booking: T) {
    // Never read mutable Address data for historical HOME bookings, including after soft deletion.
    return { ...booking, address: booking.mode === 'HOME' ? booking.addressSnapshot : null };
  }

  private async validPromotion(userId: string, code: string, subtotal: number, db: Prisma.TransactionClient) {
    const now = new Date();
    const promotion = await db.promotion.findFirst({ where: { code: code.trim().toUpperCase(), isActive: true, startsAt: { lte: now }, endsAt: { gte: now } } });
    if (!promotion) throw new BadRequestException('Ma khuyen mai khong hop le hoac da het han');
    if (subtotal < Number(promotion.minOrderAmount)) throw new BadRequestException('Don hang chua dat gia tri toi thieu');
    const userUses = await db.promotionUsage.count({ where: { promotionId: promotion.id, userId } });
    if (userUses >= promotion.perUserLimit || (promotion.usageLimit !== null && promotion.usedCount >= promotion.usageLimit)) throw new BadRequestException('Ma khuyen mai da het luot su dung');
    return promotion;
  }

  private discount(promotion: { type: string; value: unknown; maxDiscount: unknown }, subtotal: number) {
    let value = promotion.type === 'PERCENT' ? subtotal * Number(promotion.value) / 100 : Number(promotion.value);
    if (promotion.maxDiscount !== null) value = Math.min(value, Number(promotion.maxDiscount));
    return Math.min(subtotal, Math.max(0, Math.round(value)));
  }

  private async notifyBookingCreated(customerId: string, technicianUserId: string, bookingId: string) {
    const title = 'Ban co lich dat moi';
    const body = 'Mot lich hen moi dang cho xac nhan.';
    await this.notifications.create(technicianUserId, 'BOOKING_CREATED', title, body, `matxa://bookings/${bookingId}`);
    await this.notifications.sendPush(technicianUserId, title, body, { type: 'BOOKING_CREATED', bookingId, customerId });
  }

  private async notifyStatus(userId: string, bookingId: string, type: string, title: string, body: string) {
    try {
      await this.notifications.create(userId, type, title, body, `matxa://bookings/${bookingId}`);
      await this.notifications.sendPush(userId, title, body, { type, bookingId });
    } catch {
      // Booking state must not roll back or return 500 only because FCM is unavailable.
    }
  }
}
