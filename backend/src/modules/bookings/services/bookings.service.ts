import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { applyPriceOptions, loadBookableServices } from '../../marketplace/services/technician-selection';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { VnpayService } from './vnpay.service';
import { BookingHistoryQueryDto, CancelBookingDto, CreateBookingDto, CreateOpenBookingDto, CreateReviewDto, QuoteBookingDto, TechnicianJobQueryDto, UpdateBookingStatusDto } from '../dto/booking.dto';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly vnpay: VnpayService,
  ) {}

  async quote(userId: string, dto: QuoteBookingDto, db: Prisma.TransactionClient = this.prisma) {
    const baseServices = await loadBookableServices(db, dto.technicianId, dto.serviceIds, dto.mode);
    const services = await applyPriceOptions(db, baseServices, dto.priceOptionIds);
    const durationMinutes = services.reduce((sum, item) => sum + item.durationMinutes, 0);
    const scheduledStart = new Date(dto.scheduledStart);
    const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60_000);
    if (!Number.isFinite(scheduledStart.getTime()) || scheduledStart <= new Date()) throw new BadRequestException('Thoi gian dat lich phai o tuong lai');
    if (dto.mode !== 'HOME' && dto.addressId) throw new BadRequestException('Chi gui addressId khi dat tai nha');
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
    // A promotion is validated against the service subtotal, but its discount can
    // never make the payable amount negative (including the HOME service fee).
    const discountAmount = promotion ? this.discount(promotion, subtotal, serviceFee) : 0;
    const totalAmount = Prisma.Decimal.max(0, new Prisma.Decimal(subtotal).plus(serviceFee).minus(discountAmount)).toNumber();
    return {
      technicianId: dto.technicianId,
      technicianServiceIds: services.map((item) => item.id),
      services: services.map((item) => ({ id: item.id, serviceId: item.id, technicianServiceId: item.id, name: item.name, durationMinutes: item.durationMinutes, price: Number(item.price), priceOptionId: item.priceOptionId, priceOptionCode: item.priceOptionCode })),
      mode: dto.mode,
      scheduledStart,
      scheduledEnd,
      durationMinutes,
      totalDuration: durationMinutes,
      totalDurationMinutes: durationMinutes,
      startAt: scheduledStart, endAt: scheduledEnd, serviceMode: dto.mode,
      addressSnapshot,
      subtotal,
      serviceFee,
      homeServiceFee: serviceFee,
      promotionId: promotion?.id ?? null,
      promotionUsageLimit: promotion?.usageLimit ?? null,
      promotionCode: promotion?.code ?? null,
      discountAmount,
      discount: discountAmount,
      promotion: promotion ? { id: promotion.id, code: promotion.code, discount: discountAmount } : null,
      totalAmount,
      total: totalAmount,
    };
  }

  async create(userId: string, dto: CreateBookingDto) {
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
        if (quote.promotionId) {
          // Atomic reservation prevents two concurrent requests from consuming the
          // final voucher usage. A later failure rolls this increment back.
          const reserved = await tx.promotion.updateMany({
            where: {
              id: quote.promotionId,
              isActive: true,
              startsAt: { lte: new Date() },
              endsAt: { gte: new Date() },
              ...(quote.promotionUsageLimit === null
                ? {}
                : { usageLimit: quote.promotionUsageLimit, usedCount: { lt: quote.promotionUsageLimit } }),
            },
            data: { usedCount: { increment: 1 } },
          });
          if (!reserved.count) throw new BadRequestException('Ma khuyen mai da het luot su dung');
        }
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
            items: { create: quote.services.map((item) => ({ serviceId: item.id, priceOptionId: item.priceOptionId, priceOptionCode: item.priceOptionCode, serviceName: item.name, durationMinutes: item.durationMinutes, unitPrice: item.price })) },
            payment: { create: { method: dto.paymentMethod, status: dto.paymentMethod === 'CASH' ? 'UNPAID' : 'PENDING', amount: quote.totalAmount } },
            ...(quote.promotionId ? { promotionUsage: { create: { promotionId: quote.promotionId, userId } } } : {}),
          },
          include: { items: true, payment: true, technician: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } }, address: true },
        });
        return created;
      }, { isolationLevel: 'Serializable' });
      this.notifyBookingCreated(userId, booking.technician!.userId, booking.id).catch(() => undefined);
      return this.createdBookingResponse(this.withHistoricalAddress(booking));
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if ((error as { code?: string })?.code === 'P2034') throw new ConflictException('Du lieu dat lich vua thay doi, vui long thu lai');
      const databaseError = error as { code?: string; meta?: { constraint?: string }; message?: string };
      if ((databaseError.code === 'P2004' && databaseError.meta?.constraint === 'bookings_no_active_overlap') ||
          databaseError.message?.includes('bookings_no_active_overlap') || databaseError.message?.includes('could not serialize')) {
        throw new ConflictException({ code: 'SLOT_UNAVAILABLE', message: 'Khung gio vua duoc nguoi khac dat, vui long chon gio khac' });
      }
      throw error;
    }
  }

  async createVnpayPayment(userId: string, bookingId: string, ipAddress: string) {
    const payment = await this.prisma.payment.findFirst({ where: { bookingId, booking: { customerId: userId } }, include: { booking: { select: { id: true } } } });
    if (!payment) throw new NotFoundException('Thanh toan khong ton tai');
    if (payment.method !== 'ONLINE') throw new BadRequestException('Booking khong dung thanh toan online');
    if (payment.status === 'PAID') return { bookingId, paymentId: payment.id, status: 'PAID', paymentUrl: null };
    const ttlMinutes = Number(this.config.get('VNPAY_PAYMENT_TTL_MINUTES', 15));
    if (!Number.isInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > 60) throw new BadRequestException('VNPAY_PAYMENT_TTL_MINUTES khong hop le');
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
    const txnRef = payment.providerRef ?? payment.id.replace(/-/g, '');
    await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'PENDING', provider: 'VNPAY', providerRef: txnRef, expiresAt } });
    return { bookingId, paymentId: payment.id, status: 'PENDING', expiresAt, paymentUrl: this.vnpay.createPaymentUrl({ txnRef, amountVnd: Number(payment.amount), orderInfo: `MATXA ${bookingId}`, ipAddress, expiresAt }) };
  }

  async processVnpayIpn(params: Record<string, string | undefined>) {
    if (!this.vnpay.verify(params)) return { RspCode: '97', Message: 'Invalid signature' };
    if (params.vnp_TmnCode !== this.config.get<string>('VNPAY_TMN_CODE')) return { RspCode: '97', Message: 'Invalid merchant' };
    const ref = params.vnp_TxnRef;
    const amount = Number(params.vnp_Amount) / 100;
    if (!ref || !Number.isFinite(amount)) return { RspCode: '04', Message: 'Invalid request' };
    const payment = await this.prisma.payment.findFirst({ where: { provider: 'VNPAY', providerRef: ref } });
    if (!payment || Number(payment.amount) !== amount) return { RspCode: '04', Message: 'Order not found' };
    if (payment.status === 'PAID') return { RspCode: '02', Message: 'Order already confirmed' };
    if (params.vnp_ResponseCode !== '00' || params.vnp_TransactionStatus !== '00') {
      await this.prisma.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'FAILED', responseCode: params.vnp_ResponseCode ?? null, ipnReceivedAt: new Date() } });
      return { RspCode: '00', Message: 'Confirm Success' };
    }
    if (payment.expiresAt && payment.expiresAt < new Date()) return { RspCode: '04', Message: 'Order expired' };
    const updated = await this.prisma.payment.updateMany({ where: { id: payment.id, status: { in: ['PENDING', 'UNPAID'] } }, data: { status: 'PAID', paidAt: new Date(), ipnReceivedAt: new Date(), responseCode: params.vnp_ResponseCode ?? null, providerTransactionNo: params.vnp_TransactionNo ?? null, bankCode: params.vnp_BankCode ?? null, bankTranNo: params.vnp_BankTranNo ?? null } });
    return updated.count ? { RspCode: '00', Message: 'Confirm Success' } : { RspCode: '02', Message: 'Order already confirmed' };
  }

  async vnpayReturn(params: Record<string, string | undefined>) {
    if (!this.vnpay.verify(params) || params.vnp_TmnCode !== this.config.get<string>('VNPAY_TMN_CODE')) return { valid: false, status: 'INVALID_SIGNATURE' };
    const payment = params.vnp_TxnRef ? await this.prisma.payment.findFirst({ where: { provider: 'VNPAY', providerRef: params.vnp_TxnRef }, select: { bookingId: true, status: true, amount: true } }) : null;
    if (!payment || Number(payment.amount) !== Number(params.vnp_Amount) / 100) return { valid: false, status: 'NOT_FOUND' };
    // Return URL is presentation only. IPN remains the sole writer of PAID.
    return { valid: true, bookingId: payment.bookingId, paymentStatus: payment.status, gatewayResponseCode: params.vnp_ResponseCode ?? null };
  }

  /** Creates an unassigned marketplace request from platform-owned catalog items. */
  async createOpen(userId: string, dto: CreateOpenBookingDto) {
    const phone = await this.prisma.userIdentity.findFirst({ where: { userId, provider: 'PHONE', phoneNumber: { not: null } }, select: { id: true } });
    if (!phone) throw new ForbiddenException({ statusCode: 403, code: 'PHONE_VERIFICATION_REQUIRED', message: 'Vui long xac thuc so dien thoai truoc khi dat dich vu' });
    const start = new Date(dto.scheduledStart);
    if (!Number.isFinite(start.getTime()) || start <= new Date()) throw new BadRequestException('Thoi gian dat lich phai o tuong lai');
    if (dto.mode !== 'HOME' && dto.addressId) throw new BadRequestException('Chi gui addressId khi dat tai nha');
    const deadline = dto.applicationDeadlineAt ? new Date(dto.applicationDeadlineAt) : null;
    if (deadline && (!Number.isFinite(deadline.getTime()) || deadline <= new Date() || deadline >= start)) throw new BadRequestException('Han ung tuyen phai nam giua hien tai va gio dat lich');
    const catalogIds = [...new Set(dto.items.map((item) => item.catalogServiceId))];
    if (catalogIds.length !== dto.items.length) throw new BadRequestException('Khong duoc trung dich vu catalog');
    const catalog = await this.prisma.serviceCatalogItem.findMany({ where: { id: { in: catalogIds }, isActive: true, category: { isActive: true } }, include: { category: { select: { name: true } }, priceOptions: { where: { isActive: true } } } });
    if (catalog.length !== catalogIds.length) throw new BadRequestException('Dich vu catalog khong hop le hoac da ngung hoat dong');
    if (catalog.some((item) => !item.modes.includes(dto.mode))) throw new BadRequestException('Dich vu khong ho tro hinh thuc dat nay');
    let addressSnapshot: Prisma.InputJsonValue | undefined;
    if (dto.mode === 'HOME') {
      if (!dto.addressId) throw new BadRequestException('Dat tai nha can chon dia chi');
      const address = await this.prisma.address.findFirst({ where: { id: dto.addressId, userId, deletedAt: null }, select: { id: true, address: true, latitude: true, longitude: true, label: true } });
      if (!address) throw new BadRequestException('Dia chi khong hop le');
      addressSnapshot = { id: address.id, addressText: address.address, address: address.address, latitude: Number(address.latitude), longitude: Number(address.longitude), label: address.label, city: dto.city, district: dto.district ?? null };
    }
    const ordered = dto.items.map((item) => {
      const service = catalog.find((value) => value.id === item.catalogServiceId)!;
      const option = service.priceOptions.find((value) => value.id === item.priceOptionId);
      if (!option) throw new BadRequestException('Goi gia catalog khong hop le hoac da ngung hoat dong');
      return { service, option };
    });
    const durationMinutes = ordered.reduce((sum, item) => sum + item.option.durationMinutes, 0);
    const serviceFee = dto.mode === 'HOME' ? Number(this.config.get('HOME_SERVICE_FEE', 100000)) : 0;
    const subtotal = ordered.reduce((sum, item) => sum + Number(item.option.price), 0);
    const created = await this.prisma.booking.create({ data: {
      customerId: userId, assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN', mode: dto.mode,
      addressId: dto.mode === 'HOME' ? dto.addressId : null, addressSnapshot: addressSnapshot ?? { city: dto.city, district: dto.district ?? null },
      applicationDeadlineAt: deadline, scheduledStart: start, scheduledEnd: new Date(start.getTime() + durationMinutes * 60_000),
      subtotal, serviceFee, discountAmount: 0, totalAmount: subtotal + serviceFee, note: dto.note,
      items: { create: ordered.map(({ service, option }) => ({ catalogServiceId: service.id, catalogPriceOptionId: option.id, categoryId: service.categoryId, categoryName: service.category.name, serviceName: service.name, durationMinutes: option.durationMinutes, unitPrice: option.price })) },
      payment: { create: { method: dto.paymentMethod, status: 'UNPAID', amount: subtotal + serviceFee } },
    }, include: { items: { include: { catalogService: true } }, payment: true } });
    return this.openBookingResponse(created, null, false);
  }

  async applyToOpenJob(userId: string, bookingId: string) {
    const profile = await this.requireActiveTechnician(userId);
    const booking = await this.openJobForTechnician(bookingId, profile.id, true);
    const existing = await this.prisma.bookingTechnicianApplication.findUnique({ where: { bookingId_technicianProfileId: { bookingId, technicianProfileId: profile.id } } });
    if (existing?.status === 'APPLIED') return { ...existing, idempotent: true };
    if (existing) throw new ConflictException('Trang thai ung tuyen hien tai khong cho phep apply lai');
    try {
      const application = await this.prisma.bookingTechnicianApplication.create({ data: { bookingId, technicianProfileId: profile.id, status: 'APPLIED', appliedAt: new Date() } });
      void this.notifyStatus(booking.customerId, bookingId, 'TECHNICIAN_APPLIED', 'Co KTV ung tuyen', 'Mot KTV da gui ung tuyen cho don cua ban.');
      return application;
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') return this.prisma.bookingTechnicianApplication.findUniqueOrThrow({ where: { bookingId_technicianProfileId: { bookingId, technicianProfileId: profile.id } } });
      throw error;
    }
  }

  async declineOpenJob(userId: string, bookingId: string) {
    const profile = await this.requireActiveTechnician(userId);
    await this.openJobForTechnician(bookingId, profile.id, true);
    const existing = await this.prisma.bookingTechnicianApplication.findUnique({ where: { bookingId_technicianProfileId: { bookingId, technicianProfileId: profile.id } } });
    if (existing) return existing;
    return this.prisma.bookingTechnicianApplication.create({ data: { bookingId, technicianProfileId: profile.id, status: 'DECLINED', declinedAt: new Date() } });
  }

  async withdrawOpenJobApplication(userId: string, bookingId: string) {
    const profile = await this.requireActiveTechnician(userId);
    const updated = await this.prisma.bookingTechnicianApplication.updateMany({ where: { bookingId, technicianProfileId: profile.id, status: 'APPLIED', booking: { assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN' } }, data: { status: 'WITHDRAWN', withdrawnAt: new Date() } });
    if (!updated.count) throw new ConflictException('Khong the rut ung tuyen o trang thai hien tai');
    return this.prisma.bookingTechnicianApplication.findUniqueOrThrow({ where: { bookingId_technicianProfileId: { bookingId, technicianProfileId: profile.id } } });
  }

  async selectTechnician(customerId: string, bookingId: string, applicationId: string) {
    let result: { booking: any; winnerUserId: string; loserUserIds: string[] };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.booking.updateMany({ where: { id: bookingId, customerId, assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN', technicianId: null }, data: { status: 'OPEN' } });
        if (!claimed.count) throw new ConflictException('Don da duoc chon KTV, huy, hoac khong con mo');
        const application = await tx.bookingTechnicianApplication.findFirst({ where: { id: applicationId, bookingId, status: 'APPLIED' }, include: { technicianProfile: { include: { user: { select: { id: true } } } } } });
        if (!application) throw new BadRequestException('Ung tuyen khong hop le');
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { items: { include: { catalogService: true } } } });
        await this.assertOpenEligibility(tx, booking, application.technicianProfileId);
        const now = new Date();
        await tx.bookingTechnicianApplication.update({ where: { id: application.id }, data: { status: 'SELECTED', selectedAt: now } });
        await tx.bookingTechnicianApplication.updateMany({ where: { bookingId, id: { not: application.id }, status: 'APPLIED' }, data: { status: 'NOT_SELECTED' } });
        const assigned = await tx.booking.update({ where: { id: bookingId }, data: { technicianId: application.technicianProfileId, status: 'CONFIRMED' }, include: { items: { include: { catalogService: true } }, payment: true } });
        const losers = await tx.bookingTechnicianApplication.findMany({ where: { bookingId, status: 'NOT_SELECTED' }, include: { technicianProfile: { select: { userId: true } } } });
        return { booking: assigned, winnerUserId: application.technicianProfile.user.id, loserUserIds: losers.map((item) => item.technicianProfile.userId) };
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2034') throw new ConflictException('Don dang duoc chon KTV, vui long thu lai');
      throw error;
    }
    void this.notifyStatus(result.winnerUserId, bookingId, 'TECHNICIAN_SELECTED', 'Ban da duoc chon', 'Khach hang da chon ban cho don dich vu.');
    for (const userId of result.loserUserIds) void this.notifyStatus(userId, bookingId, 'TECHNICIAN_NOT_SELECTED', 'Khach da chon KTV khac', 'Don nay da duoc gan cho mot KTV khac.');
    return this.openBookingResponse(result.booking, 'SELECTED', true);
  }

  async listMine(userId: string): Promise<any[]>;
  async listMine(userId: string, query: BookingHistoryQueryDto): Promise<{ items: any[]; total: number; page: number; limit: number }>;
  async listMine(userId: string, query?: BookingHistoryQueryDto) {
    const options = query ?? Object.assign(new BookingHistoryQueryDto(), { page: 1, limit: 100 });
    const where: Prisma.BookingWhereInput = { OR: [{ customerId: userId }, { technician: { userId } }], ...(options.status ? { status: options.status as any } : {}) };
    const listQuery = this.prisma.booking.findMany({
      where, skip: (options.page - 1) * options.limit, take: options.limit,
      include: { items: true, payment: true, address: true, customer: { select: { id: true, displayName: true, avatarUrl: true } }, technician: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } }, review: true },
      orderBy: { scheduledStart: 'desc' },
    });
    if (!query) {
      const bookings = await listQuery;
      return bookings.map((booking) => this.historyResponse(this.withHistoricalAddress(booking), userId));
    }
    const [bookings, total] = await Promise.all([listQuery, this.prisma.booking.count({ where })]);
    const items = bookings.map((booking) => this.historyResponse(this.withHistoricalAddress(booking), userId));
    return query ? { items, total, page: options.page, limit: options.limit } : items;
  }

  async detail(userId: string, id: string, internal = false) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { items: true, payment: true, address: true, promotion: true, review: true, customer: { select: { id: true, displayName: true, avatarUrl: true, role: true } }, technician: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
    });
    if (!booking) throw new NotFoundException('Lich dat khong ton tai');
    const actor = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (booking.customerId !== userId && booking.technician?.userId !== userId && actor?.role !== 'ADMIN') throw new ForbiddenException('Ban khong co quyen xem lich dat');
    const historical = this.withHistoricalAddress(booking);
    return internal ? historical : this.historyResponse(historical, userId);
  }

  async listTechnicianJobs(userId: string, query: TechnicianJobQueryDto) {
    const profile = await this.requireActiveTechnician(userId);
    const directWhere: Prisma.BookingWhereInput = { technician: { userId }, assignmentMode: 'DIRECT', ...(query.status && ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].includes(query.status) ? { status: query.status as any } : {}) };
    const openWhere: Prisma.BookingWhereInput = {
      assignmentMode: 'OPEN_MARKETPLACE',
      ...(query.city ? { addressSnapshot: { path: ['city'], equals: query.city } } : {}),
      ...(query.status && ['OPEN', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].includes(query.status) ? { status: query.status as any } : {}),
      OR: [{ status: 'OPEN' }, { applications: { some: { technicianProfileId: profile.id } } }],
      ...(query.serviceId ? { items: { some: { catalogServiceId: query.serviceId } } } : {}),
    };
    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({ where: { OR: [directWhere, openWhere] }, skip: (query.page - 1) * query.limit, take: query.limit,
        include: { items: { include: { catalogService: true } }, payment: true, address: true, customer: { select: { id: true, displayName: true, avatarUrl: true } }, technician: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } }, review: true, applications: { where: { technicianProfileId: profile.id } } },
        orderBy: [{ status: 'asc' }, { scheduledStart: 'asc' }] }),
      this.prisma.booking.count({ where: { OR: [directWhere, openWhere] } }),
    ]);
    const visible = [] as any[];
    for (const booking of bookings) {
      const app = booking.applications[0] ?? null;
      if (booking.assignmentMode === 'OPEN_MARKETPLACE' && booking.status === 'OPEN' && !app) {
        try { await this.assertOpenEligibility(this.prisma, booking, profile.id); } catch { continue; }
      }
      if (query.status && ['APPLIED', 'SELECTED', 'NOT_SELECTED', 'WITHDRAWN', 'DECLINED', 'EXPIRED'].includes(query.status) && app?.status !== query.status) continue;
      visible.push(booking.assignmentMode === 'OPEN_MARKETPLACE' ? this.openBookingResponse(booking, app?.status ?? null, Boolean(app?.status === 'SELECTED')) : this.technicianJobResponse(this.withHistoricalAddress(booking), userId));
    }
    return { items: visible, total, page: query.page, limit: query.limit };
  }

  async technicianJobDetail(userId: string, id: string) {
    const profile = await this.requireActiveTechnician(userId);
    const booking = await this.detail(userId, id, true);
    if (booking.assignmentMode === 'OPEN_MARKETPLACE') {
      const application = await this.prisma.bookingTechnicianApplication.findUnique({ where: { bookingId_technicianProfileId: { bookingId: id, technicianProfileId: profile.id } } });
      if (booking.status === 'OPEN' && !application) await this.assertOpenEligibility(this.prisma, booking, profile.id);
      else if (!application) throw new ForbiddenException('Don khong thuoc ky thuat vien nay');
      return this.openBookingResponse(booking, application?.status ?? null, application?.status === 'SELECTED');
    }
    if (booking.technician?.userId !== userId) throw new ForbiddenException('Don khong thuoc ky thuat vien nay');
    return this.technicianJobResponse(booking, userId);
  }

  async technicianJobContact(userId: string, id: string) {
    await this.requireActiveTechnician(userId);
    const booking = await this.prisma.booking.findUnique({ where: { id }, select: { customerId: true, status: true, assignmentMode: true, technician: { select: { id: true, userId: true } }, customer: { select: { displayName: true } } } });
    if (!booking || booking.technician?.userId !== userId) throw new NotFoundException('Don khong ton tai');
    if (!['CONFIRMED', 'COMPLETED'].includes(booking.status)) throw new ForbiddenException('Chi hien so lien he sau khi da nhan don');
    if (booking.assignmentMode === 'OPEN_MARKETPLACE') {
      const selected = await this.prisma.bookingTechnicianApplication.findFirst({ where: { bookingId: id, technicianProfileId: booking.technician!.id, status: 'SELECTED' }, select: { id: true } });
      if (!selected) throw new ForbiddenException('KTV chua duoc chon cho don nay');
    }
    const phone = await this.prisma.userIdentity.findFirst({ where: { userId: booking.customerId, provider: 'PHONE', phoneNumber: { not: null } }, select: { phoneNumber: true } });
    if (!phone?.phoneNumber) throw new NotFoundException('Khach chua co so dien thoai xac thuc');
    return { bookingId: id, displayName: booking.customer.displayName, phoneNumber: phone.phoneNumber };
  }

  acceptTechnicianJob(userId: string, id: string) { return this.updateStatus(userId, id, { status: 'CONFIRMED' }); }

  async declineTechnicianJob(userId: string, id: string, dto: CancelBookingDto) {
    const booking = await this.detail(userId, id, true);
    if (booking.assignmentMode === 'OPEN_MARKETPLACE') return this.declineOpenJob(userId, id);
    if (booking.technician.userId !== userId) throw new ForbiddenException('Don khong thuoc ky thuat vien nay');
    if (booking.status !== 'PENDING') throw new BadRequestException('Chi co the tu choi don moi');
    return this.cancel(userId, id, dto);
  }

  completeTechnicianJob(userId: string, id: string) { return this.updateStatus(userId, id, { status: 'COMPLETED' }); }

  async cancel(userId: string, id: string, dto: CancelBookingDto) {
    const booking = await this.detail(userId, id, true);
    if (!['OPEN', 'PENDING', 'CONFIRMED'].includes(booking.status)) throw new BadRequestException('Lich dat khong the huy');
    if (dto.reasonCode === 'OTHER' && !dto.reasonText?.trim()) throw new BadRequestException('Vui long nhap ly do khac');
    const actor = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const updated = await this.transition(id, booking.status, {
      status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: dto.reasonText ?? dto.reason,
      cancellationReasonCode: dto.reasonCode, cancellationReasonText: dto.reasonText,
      cancelledByUserId: userId, cancelledByRole: actor?.role,
    });
    if (booking.assignmentMode === 'OPEN_MARKETPLACE' && booking.status === 'OPEN') {
      await this.prisma.bookingTechnicianApplication.updateMany({ where: { bookingId: id, status: 'APPLIED' }, data: { status: 'EXPIRED', expiredAt: new Date() } });
    }
    const technicianUserId = booking.technician?.userId;
    const recipients = actor?.role === 'ADMIN' ? [booking.customerId, technicianUserId].filter(Boolean) as string[] : [booking.customerId === userId ? technicianUserId : booking.customerId].filter(Boolean) as string[];
    for (const recipient of recipients) void this.notifyStatus(recipient, id, 'BOOKING_CANCELLED', 'Lich hen da huy', 'Mot lich hen da duoc huy.');
    return updated;
  }

  async updateStatus(userId: string, id: string, dto: UpdateBookingStatusDto) {
    const booking = await this.detail(userId, id, true);
    if (booking.technician?.userId !== userId) throw new ForbiddenException('Chi ky thuat vien moi co the cap nhat trang thai');
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
      if (!booking.technicianId) throw new BadRequestException('Don chua duoc gan KTV');
      const review = await tx.review.create({ data: { bookingId: id, userId, technicianId: booking.technicianId, rating: dto.rating, comment: dto.comment?.trim() || null } });
      const aggregate = await tx.review.aggregate({ where: { technicianId: booking.technicianId }, _avg: { rating: true }, _count: { id: true } });
      const reviewCount = typeof aggregate._count === 'number' ? aggregate._count : aggregate._count.id;
      await tx.technicianProfile.update({ where: { id: booking.technicianId }, data: { averageRating: aggregate._avg?.rating ?? 0, reviewCount } });
      return {
        id: review.id,
        bookingId: review.bookingId ?? id,
        rating: review.rating ?? dto.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        technician: {
          technicianId: booking.technicianId,
          averageRating: Number(aggregate._avg?.rating ?? 0),
          reviewCount,
        },
      };
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
    expectedStatus: 'OPEN' | 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED',
    data: { status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'; cancelledAt?: Date; cancellationReason?: string; cancellationReasonCode?: 'NO_LONGER_NEEDED' | 'SERVICE_ISSUE' | 'PAYMENT_REFUND_ISSUE' | 'OTHER'; cancellationReasonText?: string; cancelledByUserId?: string; cancelledByRole?: 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN' },
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

  private async requireActiveTechnician(userId: string) {
    const profile = await this.prisma.technicianProfile.findFirst({ where: { userId, isActive: true, isVerified: true, user: { status: 'ACTIVE' } }, select: { id: true } });
    if (!profile) throw new ForbiddenException('Tai khoan KTV chua du dieu kien nhan don');
    return profile;
  }

  private async openJobForTechnician(bookingId: string, technicianProfileId: string, requireEligible: boolean) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { items: { include: { catalogService: true } } } });
    if (!booking || booking.assignmentMode !== 'OPEN_MARKETPLACE' || booking.status !== 'OPEN' || booking.technicianId) throw new ConflictException('Don khong con mo de ung tuyen');
    if (booking.applicationDeadlineAt && booking.applicationDeadlineAt <= new Date()) throw new ConflictException('Don da het han ung tuyen');
    if (requireEligible) await this.assertOpenEligibility(this.prisma, booking, technicianProfileId);
    return booking;
  }

  /** Rechecked on list, apply and selection. It deliberately permits overlapping applications. */
  private async assertOpenEligibility(db: Prisma.TransactionClient | PrismaService, booking: any, technicianProfileId: string) {
    if (booking.assignmentMode !== 'OPEN_MARKETPLACE' || booking.status !== 'OPEN') throw new ConflictException('Don khong con mo');
    const profile = await db.technicianProfile.findFirst({ where: { id: technicianProfileId, isActive: true, isVerified: true, user: { status: 'ACTIVE', role: 'TECHNICIAN', technicianApplication: { is: { status: 'APPROVED' } } } }, select: { id: true, city: true, district: true, serviceModes: true } });
    if (!profile) throw new ForbiddenException('Tai khoan KTV chua du dieu kien nhan don');
    const snapshot = booking.addressSnapshot && typeof booking.addressSnapshot === 'object' ? booking.addressSnapshot as any : null;
    if (snapshot?.city && profile.city && snapshot.city !== profile.city) throw new ForbiddenException('KTV khong phu hop khu vuc cua don');
    if (snapshot?.district && profile.district && snapshot.district !== profile.district) throw new ForbiddenException('KTV khong phu hop quan huyen cua don');
    if (!profile.serviceModes.includes(booking.mode)) throw new ForbiddenException('KTV khong ho tro hinh thuc dich vu nay');
    const catalogItems = (booking.items ?? []).map((item: any) => item.catalogService).filter(Boolean);
    if (!catalogItems.length || catalogItems.length !== (booking.items ?? []).length) throw new BadRequestException('Du lieu dich vu OPEN khong hop le');
    for (const catalog of catalogItems) {
      const service = await db.technicianService.findFirst({ where: { technicianId: profile.id, isActive: true, categoryId: catalog.categoryId, modes: { has: booking.mode } }, select: { id: true } });
      if (!service) throw new ForbiddenException('KTV chua co dich vu phu hop voi don nay');
    }
    const available = await db.availabilitySlot.findFirst({ where: { technicianId: profile.id, isAvailable: true, startAt: { lte: booking.scheduledStart }, endAt: { gte: booking.scheduledEnd } }, select: { id: true } });
    if (!available) throw new ConflictException('KTV khong ranh trong khung gio nay');
    const conflict = await db.booking.findFirst({ where: { technicianId: profile.id, status: 'CONFIRMED', scheduledStart: { lt: booking.scheduledEnd }, scheduledEnd: { gt: booking.scheduledStart }, id: { not: booking.id } }, select: { id: true } });
    if (conflict) throw new ConflictException('KTV da co lich trung thoi gian');
  }

  private openBookingResponse(booking: any, applicationStatus: string | null, selected: boolean) {
    const canApply = booking.status === 'OPEN' && !applicationStatus;
    return {
      bookingId: booking.id, id: booking.id, assignmentMode: booking.assignmentMode, bookingStatus: booking.status,
      applicationStatus, scheduledAt: booking.scheduledStart, scheduledStart: booking.scheduledStart, scheduledEnd: booking.scheduledEnd,
      mode: booking.mode, paymentMethod: booking.payment?.method ?? 'CASH', durationMinutes: (booking.items ?? []).reduce((sum: number, item: any) => sum + item.durationMinutes, 0),
      subtotal: Number(booking.subtotal), serviceFee: Number(booking.serviceFee), totalAmount: Number(booking.totalAmount),
      items: (booking.items ?? []).map((item: any) => ({ catalogServiceId: item.catalogServiceId, name: item.serviceName, durationMinutes: item.durationMinutes, price: Number(item.unitPrice) })),
      customer: selected && booking.customer ? { id: booking.customer.id, displayName: booking.customer.displayName, avatarUrl: booking.customer.avatarUrl } : null,
      address: selected ? (booking.addressSnapshot ?? null) : null,
      canApply, canDecline: canApply, canWithdraw: booking.status === 'OPEN' && applicationStatus === 'APPLIED',
      canContact: selected && ['CONFIRMED', 'COMPLETED'].includes(booking.status), canCancel: selected && booking.status === 'CONFIRMED',
      canComplete: selected && booking.status === 'CONFIRMED' && new Date(booking.scheduledEnd) <= new Date(),
      customerSelectedAnotherTechnician: applicationStatus === 'NOT_SELECTED', applicationDeadlineAt: booking.applicationDeadlineAt ?? null,
    };
  }

  private withHistoricalAddress<T extends {
    addressSnapshot: Prisma.JsonValue;
    mode: string;
    address?: { id: string; address: string; latitude: unknown; longitude: unknown; label: string | null } | null;
  }>(booking: T) {
    if (booking.mode !== 'HOME') return { ...booking, address: null };
    // A snapshot is immutable history. The live relation is used only for legacy rows created
    // before address_snapshot existed, and is projected to the same safe public shape.
    if (booking.addressSnapshot && typeof booking.addressSnapshot === 'object' && !Array.isArray(booking.addressSnapshot)) {
      return { ...booking, address: booking.addressSnapshot };
    }
    const legacy = booking.address;
    return {
      ...booking,
      address: legacy ? {
        id: legacy.id, addressText: legacy.address, address: legacy.address,
        latitude: Number(legacy.latitude), longitude: Number(legacy.longitude), label: legacy.label,
      } : null,
    };
  }

  // The create response is intentionally a mobile-facing projection. It exposes
  // immutable snapshots and public technician data, never a live customer address
  // or technician account internals.
  private createdBookingResponse(booking: any) {
    return {
      id: booking.id,
      status: booking.status,
      technician: {
        technicianId: booking.technicianId,
        displayName: booking.technician?.user?.displayName ?? null,
        avatarUrl: booking.technician?.user?.avatarUrl ?? null,
      },
      items: (Array.isArray(booking.items) ? booking.items : []).map((item: any) => ({
        technicianServiceId: item.serviceId,
        serviceId: item.serviceId,
        name: item.serviceName,
        price: Number(item.unitPrice),
        durationMinutes: item.durationMinutes,
      })),
      mode: booking.mode,
      startAt: booking.scheduledStart,
      endAt: booking.scheduledEnd,
      subtotal: Number(booking.subtotal),
      serviceFee: Number(booking.serviceFee),
      homeServiceFee: Number(booking.serviceFee),
      discount: Number(booking.discountAmount),
      discountAmount: Number(booking.discountAmount),
      total: Number(booking.totalAmount),
      totalAmount: Number(booking.totalAmount),
      paymentMethod: booking.payment?.method ?? 'CASH',
      paymentStatus: booking.payment?.status ?? null,
      address: booking.address ?? null,
      addressSnapshot: booking.address ?? null,
      note: booking.note ?? null,
      createdAt: booking.createdAt,
    };
  }

  private historyResponse(booking: any, userId: string) {
    const isCustomer = booking.customerId === userId;
    const canCancel = isCustomer && ['PENDING', 'CONFIRMED'].includes(booking.status);
    const canReview = isCustomer && booking.status === 'COMPLETED' && !booking.review;
    return {
      ...booking,
      technician: {
        technicianId: booking.technicianId,
        displayName: booking.technician?.user?.displayName ?? null,
        avatarUrl: booking.technician?.user?.avatarUrl ?? null,
      },
      items: (booking.items ?? []).map((item: any) => ({
        ...item,
        technicianServiceId: item.serviceId,
        name: item.serviceName,
        price: Number(item.unitPrice),
        unitPrice: Number(item.unitPrice),
      })),
      service: booking.items?.[0] ? {
        name: booking.items[0].serviceName,
        price: Number(booking.items[0].unitPrice),
        durationMinutes: booking.items[0].durationMinutes,
      } : null,
      startAt: booking.scheduledStart,
      endAt: booking.scheduledEnd,
      subtotal: Number(booking.subtotal),
      homeServiceFee: Number(booking.serviceFee),
      serviceFee: Number(booking.serviceFee),
      discount: Number(booking.discountAmount),
      total: Number(booking.totalAmount),
      totalAmount: Number(booking.totalAmount),
      paymentMethod: booking.payment?.method ?? null,
      canCancel,
      canReview,
      review: booking.review ? {
        id: booking.review.id,
        bookingId: booking.review.bookingId,
        rating: booking.review.rating,
        comment: booking.review.comment,
        createdAt: booking.review.createdAt,
      } : null,
      cancellation: booking.status === 'CANCELLED' ? {
        reasonCode: booking.cancellationReasonCode ?? null,
        reasonText: booking.cancellationReasonText ?? booking.cancellationReason ?? null,
        cancelledAt: booking.cancelledAt ?? null,
        cancelledBy: booking.cancelledByRole ?? null,
      } : null,
    };
  }

  private technicianJobResponse(booking: any, userId: string) {
    const base = this.historyResponse(booking, userId);
    return { ...base, jobState: booking.status === 'PENDING' ? 'NEW' : booking.status === 'CONFIRMED' ? 'ACCEPTED' : booking.status,
      canAccept: booking.status === 'PENDING', canDecline: booking.status === 'PENDING',
      canComplete: booking.status === 'CONFIRMED' && new Date(booking.scheduledEnd) <= new Date(),
      customer: booking.customer ? { id: booking.customer.id, displayName: booking.customer.displayName, avatarUrl: booking.customer.avatarUrl } : null };
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

  private discount(promotion: { type: string; value: unknown; maxDiscount: unknown }, subtotal: number, serviceFee: number) {
    let value = promotion.type === 'PERCENT' ? subtotal * Number(promotion.value) / 100 : Number(promotion.value);
    if (promotion.maxDiscount !== null) value = Math.min(value, Number(promotion.maxDiscount));
    return Math.min(subtotal + serviceFee, Math.max(0, Math.round(value)));
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
