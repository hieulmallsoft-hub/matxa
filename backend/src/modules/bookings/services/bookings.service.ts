import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { applyPriceOptions, loadBookableServices } from '../../marketplace/services/technician-selection';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { MarketplaceRealtimeService } from '../../marketplace/services/marketplace-realtime.service';
import { VnpayService } from './vnpay.service';
import { PlatformFeePolicyService } from './platform-fee-policy.service';
import { PayosService } from './payos.service';
import { Optional } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import {
  BookingHistoryQueryDto,
  CancelBookingDto,
  CreateBookingDto,
  CreateOpenBookingDto,
  CreateReviewDto,
  QuoteBookingDto,
  TechnicianJobQueryDto,
  UpdateBookingStatusDto,
} from '../dto/booking.dto';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly vnpay: VnpayService,
    private readonly feePolicy: PlatformFeePolicyService = new PlatformFeePolicyService(),
    @Optional() private readonly payos?: PayosService,
    private readonly realtime?: MarketplaceRealtimeService,
    private readonly settings?: SettingsService,
  ) {}

  async quote(userId: string, dto: QuoteBookingDto, db: Prisma.TransactionClient = this.prisma) {
    const baseServices = await loadBookableServices(db, dto.technicianId, dto.serviceIds, dto.mode);
    const services = await applyPriceOptions(db, baseServices, dto.priceOptionIds);
    const durationMinutes = services.reduce((sum, item) => sum + item.durationMinutes, 0);
    const scheduledStart = new Date(dto.scheduledStart);
    const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60_000);
    if (!Number.isFinite(scheduledStart.getTime()) || scheduledStart <= new Date())
      throw new BadRequestException('Thoi gian dat lich phai o tuong lai');
    if (dto.mode !== 'HOME' && dto.addressId) throw new BadRequestException('Chi gui addressId khi dat tai nha');
    const slot = await db.availabilitySlot.findFirst({
      where: {
        technicianId: dto.technicianId,
        isAvailable: true,
        startAt: { lte: scheduledStart },
        endAt: { gte: scheduledEnd },
      },
    });
    if (!slot) throw new BadRequestException('Ky thuat vien khong ranh trong khung gio nay');
    const conflict = await db.booking.findFirst({
      where: {
        technicianId: dto.technicianId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        scheduledStart: { lt: scheduledEnd },
        scheduledEnd: { gt: scheduledStart },
      },
      select: { id: true },
    });
    if (conflict) throw new BadRequestException('Khung gio da co nguoi dat');
    let addressSnapshot: {
      id: string;
      addressText: string;
      address: string;
      latitude: number;
      longitude: number;
      label: string | null;
    } | null = null;
    if (dto.mode === 'HOME') {
      if (!dto.addressId) throw new BadRequestException('Dat tai nha can chon dia chi');
      const address = await db.address.findFirst({
        where: { id: dto.addressId, userId, deletedAt: null },
        select: { id: true, address: true, latitude: true, longitude: true, label: true },
      });
      if (!address) throw new BadRequestException('Dia chi khong hop le');
      addressSnapshot = {
        id: address.id,
        addressText: address.address,
        address: address.address,
        latitude: Number(address.latitude),
        longitude: Number(address.longitude),
        label: address.label,
      };
    }
    const subtotal = services.reduce((sum, item) => sum.plus(item.price), new Prisma.Decimal(0)).toNumber();
    const serviceFee = dto.mode === 'HOME' ? Number(this.config.get('HOME_SERVICE_FEE', 100000)) : 0;
    if (!Number.isFinite(serviceFee) || serviceFee < 0)
      throw new BadRequestException('Phi dich vu chua duoc cau hinh hop le');
    const promotion = dto.promotionCode ? await this.validPromotion(userId, dto.promotionCode, subtotal, db) : null;
    // A promotion is validated against the service subtotal, but its discount can
    // never make the payable amount negative (including the HOME service fee).
    const discountAmount = promotion ? this.discount(promotion, subtotal, serviceFee) : 0;
    const totalAmount = Prisma.Decimal.max(
      0,
      new Prisma.Decimal(subtotal).plus(serviceFee).minus(discountAmount),
    ).toNumber();
    const financials = this.feePolicy.calculate({
      assignmentMode: 'DIRECT',
      grossServiceAmount: subtotal,
      paymentMethod: (dto as CreateBookingDto).paymentMethod ?? 'CASH',
      calculatedAt: new Date(),
    });
    return {
      technicianId: dto.technicianId,
      technicianServiceIds: services.map((item) => item.id),
      services: services.map((item) => ({
        id: item.id,
        serviceId: item.id,
        technicianServiceId: item.id,
        catalogServiceId: item.catalogServiceId ?? null,
        categoryId: item.categoryId ?? null,
        name: item.name,
        durationMinutes: item.durationMinutes,
        price: Number(item.price),
        priceOptionId: item.priceOptionId,
        priceOptionCode: item.priceOptionCode,
      })),
      mode: dto.mode,
      scheduledStart,
      scheduledEnd,
      durationMinutes,
      totalDuration: durationMinutes,
      totalDurationMinutes: durationMinutes,
      startAt: scheduledStart,
      endAt: scheduledEnd,
      serviceMode: dto.mode,
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
      grossServiceAmount: financials.grossServiceAmount.toNumber(),
      platformFee: financials.platformFee.toNumber(),
      technicianEarning: financials.technicianEarning.toNumber(),
      customerPayableAmount: totalAmount,
      feePolicyVersion: financials.feePolicyVersion,
    };
  }

  async create(userId: string, dto: CreateBookingDto) {
    const acceptanceDeadlineAt = new Date(
      Date.now() + Number(this.config.get('OPEN_BOOKING_APPLICATION_TTL_MINUTES', 15)) * 60_000,
    );
    try {
      const booking = await this.prisma.$transaction(
        async (tx) => {
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
              applicationDeadlineAt: acceptanceDeadlineAt,
              promotionId: quote.promotionId,
              mode: dto.mode,
              scheduledStart: quote.scheduledStart,
              scheduledEnd: quote.scheduledEnd,
              subtotal: quote.subtotal,
              serviceFee: quote.serviceFee,
              discountAmount: quote.discountAmount,
              totalAmount: quote.totalAmount,
              grossServiceAmount: quote.grossServiceAmount,
              platformFee: quote.platformFee,
              technicianEarning: quote.technicianEarning,
              customerPayableAmount: quote.customerPayableAmount,
              feePolicyVersion: quote.feePolicyVersion,
              note: dto.note,
              items: {
                create: quote.services.map((item) => ({
                  serviceId: item.id,
                  catalogServiceId: item.catalogServiceId ?? null,
                  categoryId: item.categoryId ?? null,
                  priceOptionId: item.priceOptionId,
                  priceOptionCode: item.priceOptionCode,
                  serviceName: item.name,
                  durationMinutes: item.durationMinutes,
                  unitPrice: item.price,
                })),
              },
              payment: {
                create: {
                  method: dto.paymentMethod,
                  status: dto.paymentMethod === 'CASH' ? 'UNPAID' : 'PENDING',
                  amount: quote.totalAmount,
                },
              },
              ...(quote.promotionId ? { promotionUsage: { create: { promotionId: quote.promotionId, userId } } } : {}),
            },
            include: {
              items: true,
              payment: true,
              technician: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
              address: true,
            },
          });
          return created;
        },
        { isolationLevel: 'Serializable' },
      );
      this.notifyBookingCreated(userId, booking.technician!.userId, booking.id).catch((error) => {
        this.logger.warn(`Khong gui duoc thong bao BOOKING_CREATED cho booking ${booking.id}: ${error instanceof Error ? error.message : 'khong ro ly do'}`);
      });
      if (booking.technicianId) this.realtime?.broadcastAvailabilityChanged(booking.technicianId);
      return this.createdBookingResponse(this.withHistoricalAddress(booking));
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if ((error as { code?: string })?.code === 'P2034')
        throw new ConflictException('Du lieu dat lich vua thay doi, vui long thu lai');
      const databaseError = error as { code?: string; meta?: { constraint?: string }; message?: string };
      if (
        (databaseError.code === 'P2004' && databaseError.meta?.constraint === 'bookings_no_active_overlap') ||
        databaseError.message?.includes('bookings_no_active_overlap') ||
        databaseError.message?.includes('could not serialize')
      ) {
        throw new ConflictException({
          code: 'SLOT_UNAVAILABLE',
          message: 'Khung gio vua duoc nguoi khac dat, vui long chon gio khac',
        });
      }
      throw error;
    }
  }

  async createVnpayPayment(userId: string, bookingId: string, ipAddress: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { bookingId, booking: { customerId: userId } },
      include: { booking: { select: { id: true } } },
    });
    if (!payment) throw new NotFoundException('Thanh toan khong ton tai');
    if (payment.method !== 'ONLINE') throw new BadRequestException('Booking khong dung thanh toan online');
    if (payment.status === 'PAID') return { bookingId, paymentId: payment.id, status: 'PAID', paymentUrl: null };
    const ttlMinutes = Number(this.config.get('VNPAY_PAYMENT_TTL_MINUTES', 15));
    if (!Number.isInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > 60)
      throw new BadRequestException('VNPAY_PAYMENT_TTL_MINUTES khong hop le');
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
    const txnRef = payment.providerRef ?? payment.id.replace(/-/g, '');
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'PENDING', provider: 'VNPAY', providerRef: txnRef, expiresAt },
    });
    return {
      bookingId,
      paymentId: payment.id,
      status: 'PENDING',
      expiresAt,
      paymentUrl: this.vnpay.createPaymentUrl({
        txnRef,
        amountVnd: Number(payment.amount),
        orderInfo: `MATXA ${bookingId}`,
        ipAddress,
        expiresAt,
      }),
    };
  }

  async createPayosPayment(userId: string, bookingId: string) {
    if (!this.payos?.isConfigured()) throw new BadRequestException('PayOS chua duoc cau hinh');
    const payment = await this.prisma.payment.findFirst({ where: { bookingId, booking: { customerId: userId } } });
    if (!payment) throw new NotFoundException('Thanh toan khong ton tai');
    if (payment.method !== 'ONLINE') throw new BadRequestException('Booking khong dung thanh toan online');
    if (payment.status === 'PAID') return { bookingId, paymentId: payment.id, status: 'PAID', paymentUrl: null };
    const expiresAt = new Date(Date.now() + Number(this.config.get('PAYOS_PAYMENT_TTL_MINUTES', 15)) * 60_000);
    const orderCode = Number(
      `${Date.now()}${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0')}`,
    );
    const data = await this.payos.createPaymentLink({
      orderCode,
      amount: Number(payment.amount),
      description: `MATXA ${bookingId.slice(0, 8)}`,
      reference: payment.id,
    });
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'PENDING', provider: 'PAYOS', providerRef: String(orderCode), expiresAt },
    });
    return {
      bookingId,
      paymentId: payment.id,
      status: 'PENDING',
      expiresAt,
      paymentUrl: data.checkoutUrl,
      paymentLinkId: data.paymentLinkId,
      qrCode: data.qrCode ?? null,
      accountNumber: data.accountNumber ?? null,
      accountName: data.accountName ?? null,
    };
  }

  async processPayosWebhook(body: Record<string, unknown>) {
    if (!this.payos) throw new BadRequestException('PayOS chua duoc cau hinh');
    const data = this.payos.verifyWebhook({
      signature: body.signature as string | undefined,
      data: body.data as Record<string, string | number | boolean | null | undefined> | undefined,
    });
    const orderCode = String(data.orderCode ?? '');
    const payment = await this.prisma.payment.findFirst({ where: { provider: 'PAYOS', providerRef: orderCode } });
    if (!payment) throw new NotFoundException('Khong tim thay payment PayOS');
    if (Number(data.amount) !== Number(payment.amount))
      throw new BadRequestException('So tien webhook PayOS khong khop');
    const success = String(body.code ?? '') === '00' && body.success === true;
    const status = success ? 'PAID' : 'FAILED';
    await this.prisma.payment.updateMany({
      where: { id: payment.id, status: { in: ['PENDING', 'UNPAID'] } },
      data: {
        status,
        providerTransactionNo: data.reference ? String(data.reference) : null,
        responseCode: String(body.code ?? ''),
        ipnReceivedAt: new Date(),
        ...(success ? { paidAt: new Date() } : {}),
      },
    });
    return { code: '00', desc: 'success' };
  }

  payosMobileRedirect(kind: 'return' | 'cancel', query: Record<string, string | undefined>) {
    if (!this.payos) throw new BadRequestException('PayOS chua duoc cau hinh');
    return this.payos.mobileRedirect(kind, query);
  }

  async processVnpayIpn(params: Record<string, string | undefined>) {
    if (!this.vnpay.verify(params)) return { RspCode: '97', Message: 'Invalid signature' };
    if (params.vnp_TmnCode !== this.config.get<string>('VNPAY_TMN_CODE'))
      return { RspCode: '97', Message: 'Invalid merchant' };
    const ref = params.vnp_TxnRef;
    const amount = Number(params.vnp_Amount) / 100;
    if (!ref || !Number.isFinite(amount)) return { RspCode: '04', Message: 'Invalid request' };
    const payment = await this.prisma.payment.findFirst({ where: { provider: 'VNPAY', providerRef: ref } });
    if (!payment || Number(payment.amount) !== amount) return { RspCode: '04', Message: 'Order not found' };
    if (payment.status === 'PAID') return { RspCode: '02', Message: 'Order already confirmed' };
    if (params.vnp_ResponseCode !== '00' || params.vnp_TransactionStatus !== '00') {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'FAILED', responseCode: params.vnp_ResponseCode ?? null, ipnReceivedAt: new Date() },
      });
      return { RspCode: '00', Message: 'Confirm Success' };
    }
    if (payment.expiresAt && payment.expiresAt < new Date()) return { RspCode: '04', Message: 'Order expired' };
    const updated = await this.prisma.payment.updateMany({
      where: { id: payment.id, status: { in: ['PENDING', 'UNPAID'] } },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        ipnReceivedAt: new Date(),
        responseCode: params.vnp_ResponseCode ?? null,
        providerTransactionNo: params.vnp_TransactionNo ?? null,
        bankCode: params.vnp_BankCode ?? null,
        bankTranNo: params.vnp_BankTranNo ?? null,
      },
    });
    return updated.count
      ? { RspCode: '00', Message: 'Confirm Success' }
      : { RspCode: '02', Message: 'Order already confirmed' };
  }

  async vnpayReturn(params: Record<string, string | undefined>) {
    if (!this.vnpay.verify(params) || params.vnp_TmnCode !== this.config.get<string>('VNPAY_TMN_CODE'))
      return { valid: false, status: 'INVALID_SIGNATURE' };
    const payment = params.vnp_TxnRef
      ? await this.prisma.payment.findFirst({
          where: { provider: 'VNPAY', providerRef: params.vnp_TxnRef },
          select: { bookingId: true, status: true, amount: true },
        })
      : null;
    if (!payment || Number(payment.amount) !== Number(params.vnp_Amount) / 100)
      return { valid: false, status: 'NOT_FOUND' };
    // Return URL is presentation only. IPN remains the sole writer of PAID.
    return {
      valid: true,
      bookingId: payment.bookingId,
      paymentStatus: payment.status,
      gatewayResponseCode: params.vnp_ResponseCode ?? null,
    };
  }

  /** Creates an unassigned marketplace request from platform-owned catalog items. */
  async matchingTechnicians(userId: string, dto: any) {
    const start = new Date(dto.scheduledStart);
    if (!Number.isFinite(start.getTime()) || start <= new Date()) throw new BadRequestException('Thoi gian dat lich khong hop le');
    const serviceIds: string[] = [...new Set((dto.items ?? []).map((item: any) => String(item.catalogServiceId)))] as string[];
    const optionIds: string[] = [...new Set((dto.items ?? []).map((item: any) => String(item.priceOptionId)))] as string[];
    if (!serviceIds.length || serviceIds.length !== (dto.items ?? []).length) throw new BadRequestException('Danh sach dich vu khong hop le');
    const [services, options] = await Promise.all([
      this.prisma.serviceCatalogItem.findMany({ where: { id: { in: serviceIds }, isActive: true }, include: { category: true } }),
      this.prisma.serviceCatalogPriceOption.findMany({ where: { id: { in: optionIds }, isActive: true } }),
    ]);
    if (services.length !== serviceIds.length || options.length !== optionIds.length) throw new BadRequestException('Dich vu hoac goi gia khong hop le');
    const duration = dto.items.reduce((sum: number, item: any) => sum + (options.find((option: any) => option.id === item.priceOptionId)?.durationMinutes ?? 0), 0);
    const end = new Date(start.getTime() + duration * 60_000);
    const candidates: any[] = await this.prisma.technicianProfile.findMany({
      where: {
        isActive: true,
        isVerified: true,
        city: dto.city,
        ...(dto.district ? { district: dto.district } : {}),
        serviceModes: { has: dto.mode },
        user: { status: 'ACTIVE', role: 'TECHNICIAN', ...(dto.search ? { displayName: { contains: dto.search, mode: 'insensitive' } } : {}), technicianApplication: { is: { status: 'APPROVED' } } },
        services: { some: { isActive: true, catalogServiceId: { in: serviceIds }, modes: { has: dto.mode } } },
      },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    });
    const location = dto.latitude !== undefined && dto.longitude !== undefined
      ? { latitude: dto.latitude, longitude: dto.longitude }
      : dto.mode === 'HOME' && dto.addressId
        ? await this.prisma.address.findFirst({ where: { id: dto.addressId, userId, deletedAt: null }, select: { latitude: true, longitude: true } }).then((a) => a && { latitude: Number(a.latitude), longitude: Number(a.longitude) })
        : null;
    const distanceKm = (latitude: unknown, longitude: unknown) => {
      if (!location || latitude === null || latitude === undefined || longitude === null || longitude === undefined) return null;
      const rad = (v: number) => (v * Math.PI) / 180;
      const a = Math.sin(rad(Number(latitude) - location.latitude) / 2) ** 2 + Math.cos(rad(location.latitude)) * Math.cos(rad(Number(latitude))) * Math.sin(rad(Number(longitude) - location.longitude) / 2) ** 2;
      return Math.round(6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a)))) * 10) / 10;
    };
    const eligible = [] as any[];
    for (const candidate of candidates) {
      const [slot, conflict, matchingServices] = await Promise.all([
        this.prisma.availabilitySlot.findFirst({ where: { technicianId: candidate.id, isAvailable: true, startAt: { lte: start }, endAt: { gte: end } } }),
        this.prisma.booking.findFirst({ where: { technicianId: candidate.id, status: 'CONFIRMED', scheduledStart: { lt: end }, scheduledEnd: { gt: start } }, select: { id: true } }),
        this.prisma.technicianService.findMany({ where: { technicianId: candidate.id, isActive: true, catalogServiceId: { in: serviceIds }, modes: { has: dto.mode } }, select: { catalogServiceId: true, categoryId: true } }),
      ]);
      const hasAllServices = services.every((service: any) => matchingServices.some((item: any) => item.catalogServiceId === service.id && item.categoryId === service.categoryId));
      if (!slot || conflict || !hasAllServices) continue;
       eligible.push({ technicianId: candidate.id, displayName: candidate.user.displayName, avatarUrl: candidate.user.avatarUrl, city: candidate.city, district: candidate.district, distanceKm: distanceKm(candidate.latitude, candidate.longitude), rating: Number(candidate.averageRating), reviewCount: candidate.reviewCount });
    }
    eligible.sort((a, b) => {
      if (dto.sort === 'rating') return b.rating - a.rating;
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });
    return { items: eligible, total: eligible.length };
  }

  async createSelectedFromCatalog(userId: string, dto: any) {
    const serviceIds = dto.items.map((item: any) => item.catalogServiceId);
    const catalogOptions = await this.prisma.serviceCatalogPriceOption.findMany({ where: { id: { in: dto.items.map((item: any) => item.priceOptionId) }, isActive: true } });
    const selected = await this.prisma.technicianService.findMany({ where: { technicianId: dto.technicianId, catalogServiceId: { in: serviceIds }, isActive: true }, include: { priceOptions: { where: { isActive: true } } } });
    if (selected.length !== serviceIds.length) throw new BadRequestException('KTV khong co dich vu phu hop');
    const priceOptionIds = dto.items.map((item: any) => {
      const service = selected.find((candidate: any) => candidate.catalogServiceId === item.catalogServiceId)!;
      const catalogOption = catalogOptions.find((candidate: any) => candidate.id === item.priceOptionId);
      const option = service.priceOptions.find((candidate: any) => candidate.durationMinutes === catalogOption?.durationMinutes) ?? service.priceOptions[0];
      if (!option) throw new BadRequestException('KTV chua co goi gia');
      return option.id;
    });
    return this.create(userId, { ...dto, serviceIds: selected.map((item: any) => item.id), priceOptionIds, technicianId: dto.technicianId } as any);
  }

  async createOpen(userId: string, dto: CreateOpenBookingDto) {
    const start = new Date(dto.scheduledStart);
    if (!Number.isFinite(start.getTime()) || start <= new Date())
      throw new BadRequestException('Thoi gian dat lich phai o tuong lai');
    if (dto.mode !== 'HOME' && dto.addressId) throw new BadRequestException('Chi gui addressId khi dat tai nha');
    const now = new Date();
    const defaultTtlMinutes = Number(this.config.get('OPEN_BOOKING_APPLICATION_TTL_MINUTES', 15));
    const requestedDeadline = dto.applicationDeadlineAt ? new Date(dto.applicationDeadlineAt) : null;
    const deadline = requestedDeadline ?? new Date(now.getTime() + defaultTtlMinutes * 60_000);
    if (!Number.isFinite(deadline.getTime()) || deadline <= now || deadline >= start)
      throw new BadRequestException('Han ung tuyen phai nam giua hien tai va gio dat lich');
    const catalogIds = [...new Set(dto.items.map((item) => item.catalogServiceId))];
    if (catalogIds.length !== dto.items.length) throw new BadRequestException('Khong duoc trung dich vu catalog');
    const catalog = await this.prisma.serviceCatalogItem.findMany({
      where: { id: { in: catalogIds }, isActive: true, category: { isActive: true } },
      include: { category: { select: { name: true } }, priceOptions: { where: { isActive: true } } },
    });
    if (catalog.length !== catalogIds.length)
      throw new BadRequestException('Dich vu catalog khong hop le hoac da ngung hoat dong');
    if (catalog.some((item) => !item.modes.includes(dto.mode)))
      throw new BadRequestException('Dich vu khong ho tro hinh thuc dat nay');
    let addressSnapshot: Prisma.InputJsonValue | undefined;
    if (dto.mode === 'HOME') {
      if (!dto.addressId) throw new BadRequestException('Dat tai nha can chon dia chi');
      const address = await this.prisma.address.findFirst({
        where: { id: dto.addressId, userId, deletedAt: null },
        select: { id: true, address: true, latitude: true, longitude: true, label: true },
      });
      if (!address) throw new BadRequestException('Dia chi khong hop le');
      addressSnapshot = {
        id: address.id,
        addressText: address.address,
        address: address.address,
        latitude: Number(address.latitude),
        longitude: Number(address.longitude),
        label: address.label,
        city: dto.city,
        district: dto.district ?? null,
      };
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
    const financials = this.feePolicy.calculate({
      assignmentMode: 'OPEN_MARKETPLACE',
      grossServiceAmount: subtotal,
      paymentMethod: dto.paymentMethod,
      calculatedAt: new Date(),
    });
    const customerPayableAmount = new Prisma.Decimal(subtotal).plus(serviceFee);
    const created = await this.prisma.booking.create({
      data: {
        customerId: userId,
        assignmentMode: 'OPEN_MARKETPLACE',
        status: 'OPEN',
        mode: dto.mode,
        addressId: dto.mode === 'HOME' ? dto.addressId : null,
        addressSnapshot: addressSnapshot ?? { city: dto.city, district: dto.district ?? null },
        applicationDeadlineAt: deadline,
        scheduledStart: start,
        scheduledEnd: new Date(start.getTime() + durationMinutes * 60_000),
        subtotal,
        serviceFee,
        discountAmount: 0,
        totalAmount: customerPayableAmount,
        grossServiceAmount: financials.grossServiceAmount,
        platformFee: financials.platformFee,
        technicianEarning: financials.technicianEarning,
        customerPayableAmount,
        feePolicyVersion: financials.feePolicyVersion,
        note: dto.note,
        items: {
          create: ordered.map(({ service, option }) => ({
            catalogServiceId: service.id,
            catalogPriceOptionId: option.id,
            categoryId: service.categoryId,
            categoryName: service.category.name,
            serviceName: service.name,
            durationMinutes: option.durationMinutes,
            unitPrice: option.price,
          })),
        },
        payment: { create: { method: dto.paymentMethod, status: 'UNPAID', amount: subtotal + serviceFee } },
      },
      include: { items: { include: { catalogService: true } }, payment: true },
    });
    void this.notifyEligibleTechniciansForOpenBooking(created);
    return {
      ...this.openBookingResponse(created, null, false),
      expiresInSeconds: Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 1000)),
    };
  }

  async applyToOpenJob(userId: string, bookingId: string) {
    const profile = await this.requireActiveTechnician(userId);
    const booking = await this.openJobForTechnician(bookingId, profile.id, true);
    const existing = await this.prisma.bookingTechnicianApplication.findUnique({
      where: { bookingId_technicianProfileId: { bookingId, technicianProfileId: profile.id } },
    });
    if (existing?.status === 'APPLIED') return { ...existing, idempotent: true };
    if (existing) throw new ConflictException('Trang thai ung tuyen hien tai khong cho phep apply lai');
    try {
      const application = await this.prisma.bookingTechnicianApplication.create({
        data: { bookingId, technicianProfileId: profile.id, status: 'APPLIED', appliedAt: new Date() },
      });
      void this.notifyStatus(
        booking.customerId,
        bookingId,
        'TECHNICIAN_APPLIED',
        'Có KTV ứng tuyển',
        'Một KTV đã gửi ứng tuyển cho đơn của bạn.',
      );
      return application;
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002')
        return this.prisma.bookingTechnicianApplication.findUniqueOrThrow({
          where: { bookingId_technicianProfileId: { bookingId, technicianProfileId: profile.id } },
        });
      throw error;
    }
  }

  async declineOpenJob(userId: string, bookingId: string) {
    const profile = await this.requireActiveTechnician(userId);
    await this.openJobForTechnician(bookingId, profile.id, true);
    const existing = await this.prisma.bookingTechnicianApplication.findUnique({
      where: { bookingId_technicianProfileId: { bookingId, technicianProfileId: profile.id } },
    });
    if (existing) return existing;
    return this.prisma.bookingTechnicianApplication.create({
      data: { bookingId, technicianProfileId: profile.id, status: 'DECLINED', declinedAt: new Date() },
    });
  }

  async withdrawOpenJobApplication(userId: string, bookingId: string) {
    const profile = await this.requireActiveTechnician(userId);
    const updated = await this.prisma.bookingTechnicianApplication.updateMany({
      where: {
        bookingId,
        technicianProfileId: profile.id,
        status: 'APPLIED',
        booking: { assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN' },
      },
      data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
    });
    if (!updated.count) throw new ConflictException('Khong the rut ung tuyen o trang thai hien tai');
    return this.prisma.bookingTechnicianApplication.findUniqueOrThrow({
      where: { bookingId_technicianProfileId: { bookingId, technicianProfileId: profile.id } },
    });
  }

  async selectTechnician(customerId: string, bookingId: string, applicationId: string) {
    let result: { booking: any; winnerUserId: string; loserUserIds: string[] };
    try {
      result = await this.prisma.$transaction(
        async (tx) => {
          const now = new Date();
          const claimed = await tx.booking.updateMany({
            where: {
              id: bookingId,
              customerId,
              assignmentMode: 'OPEN_MARKETPLACE',
              status: 'OPEN',
              technicianId: null,
              OR: [{ applicationDeadlineAt: null }, { applicationDeadlineAt: { gt: now } }],
            },
            data: { status: 'OPEN' },
          });
          if (!claimed.count) throw new ConflictException('Don da duoc chon KTV, huy, hoac khong con mo');
          const application = await tx.bookingTechnicianApplication.findFirst({
            where: { id: applicationId, bookingId, status: 'APPLIED' },
            include: { technicianProfile: { include: { user: { select: { id: true } } } } },
          });
          if (!application) throw new BadRequestException('Ung tuyen khong hop le');
          const booking = await tx.booking.findUniqueOrThrow({
            where: { id: bookingId },
            include: { items: { include: { catalogService: true } } },
          });
          await this.assertOpenEligibility(tx, booking, application.technicianProfileId);
          await this.chargeTechnicianCommission(application.technicianProfile.user.id, bookingId, tx);
          await tx.bookingTechnicianApplication.update({
            where: { id: application.id },
            data: { status: 'SELECTED', selectedAt: now },
          });
          await tx.bookingTechnicianApplication.updateMany({
            where: { bookingId, id: { not: application.id }, status: 'APPLIED' },
            data: { status: 'NOT_SELECTED' },
          });
          const assigned = await tx.booking.update({
            where: { id: bookingId },
            data: { technicianId: application.technicianProfileId, status: 'CONFIRMED' },
            include: { items: { include: { catalogService: true } }, payment: true },
          });
          const losers = await tx.bookingTechnicianApplication.findMany({
            where: { bookingId, status: 'NOT_SELECTED' },
            include: { technicianProfile: { select: { userId: true } } },
          });
          return {
            booking: assigned,
            winnerUserId: application.technicianProfile.user.id,
            loserUserIds: losers.map((item) => item.technicianProfile.userId),
          };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if ((error as { code?: string }).code === 'P2034')
        throw new ConflictException('Don dang duoc chon KTV, vui long thu lai');
      throw error;
    }
    void this.notifyStatus(
      result.winnerUserId,
      bookingId,
      'TECHNICIAN_SELECTED',
      'Bạn đã được chọn',
      'Khách hàng đã chọn bạn cho đơn dịch vụ.',
    );
    this.realtime?.broadcastAvailabilityChanged(result.booking.technicianId);
    for (const userId of result.loserUserIds)
      void this.notifyStatus(
        userId,
        bookingId,
        'TECHNICIAN_NOT_SELECTED',
        'Khách đã chọn KTV khác',
        'Đơn này đã được gán cho một KTV khác.',
      );
    return this.openBookingResponse(result.booking, 'SELECTED', true);
  }

  async listMine(userId: string): Promise<any[]>;
  async listMine(
    userId: string,
    query: BookingHistoryQueryDto,
  ): Promise<{ items: any[]; total: number; page: number; limit: number }>;
  async listMine(userId: string, query?: BookingHistoryQueryDto) {
    const options = query ?? Object.assign(new BookingHistoryQueryDto(), { page: 1, limit: 100 });
    const where: Prisma.BookingWhereInput = {
      OR: [{ customerId: userId }, { technician: { userId } }],
      ...(options.status ? { status: options.status as any } : {}),
    };
    const listQuery = this.prisma.booking.findMany({
      where,
      skip: (options.page - 1) * options.limit,
      take: options.limit,
      include: {
        items: true,
        payment: true,
        address: true,
        customer: { select: { id: true, displayName: true, avatarUrl: true, gender: true, nationality: true } },
        technician: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
        review: true,
      },
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

  async detail(userId: string, id: string, internal = false, allowMarketplaceTechnician = false) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        items: true,
        payment: true,
        address: true,
        promotion: true,
        review: true,
        customer: {
          select: { id: true, displayName: true, avatarUrl: true, gender: true, nationality: true, role: true },
        },
        technician: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
      },
    });
    if (!booking) throw new NotFoundException('Lich dat khong ton tai');
    const actor = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const marketplaceNotification = allowMarketplaceTechnician && actor?.role === 'TECHNICIAN'
      ? await this.prisma.notification.findFirst({
          where: {
            userId,
            actionUrl: `matxa://bookings/${id}`,
            type: { in: ['OPEN_BOOKING_AVAILABLE', 'BOOKING_EXPIRED', 'BOOKING_CANCELLED', 'BOOKING_FALLBACK_OPEN'] },
          },
          select: { id: true },
        })
      : null;
    const canViewMarketplaceJob =
      allowMarketplaceTechnician &&
      actor?.role === 'TECHNICIAN' &&
      booking.assignmentMode === 'OPEN_MARKETPLACE' &&
      ['OPEN', 'EXPIRED'].includes(booking.status) &&
      Boolean(marketplaceNotification);
    if (booking.customerId !== userId && booking.technician?.userId !== userId && actor?.role !== 'ADMIN' && !canViewMarketplaceJob)
      throw new ForbiddenException('Ban khong co quyen xem lich dat');
    const historical = this.withHistoricalAddress(booking);
    return internal ? historical : this.historyResponse(historical, userId);
  }

  async listTechnicianJobs(userId: string, query: TechnicianJobQueryDto) {
    const profile = await this.requireActiveTechnician(userId);
    const now = new Date();
    const directWhere: Prisma.BookingWhereInput = {
      technician: { userId },
      assignmentMode: 'DIRECT',
      ...(query.status && ['PENDING', 'EXPIRED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].includes(query.status)
        ? { status: query.status as any }
        : {}),
    };
    const openWhere: Prisma.BookingWhereInput = {
      assignmentMode: 'OPEN_MARKETPLACE',
      ...(query.city ? { addressSnapshot: { path: ['city'], equals: query.city } } : {}),
      ...(query.status && ['OPEN', 'EXPIRED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].includes(query.status)
        ? { status: query.status as any }
        : {}),
      OR: [
        { status: 'OPEN', OR: [{ applicationDeadlineAt: null }, { applicationDeadlineAt: { gt: now } }] },
        // Keep expired marketplace jobs visible in technician history even
        // when this technician never created an application record.
        { status: 'EXPIRED' },
        { applications: { some: { technicianProfileId: profile.id } } },
      ],
      ...(query.serviceId ? { items: { some: { catalogServiceId: query.serviceId } } } : {}),
    };
    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: { OR: [directWhere, openWhere] },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          items: { include: { catalogService: true } },
          payment: true,
          address: true,
          customer: { select: { id: true, displayName: true, avatarUrl: true, gender: true, nationality: true } },
          technician: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
          review: true,
          applications: { where: { technicianProfileId: profile.id } },
        },
        orderBy: [{ status: 'asc' }, { scheduledStart: 'asc' }],
      }),
      this.prisma.booking.count({ where: { OR: [directWhere, openWhere] } }),
    ]);
    const visible = [] as any[];
    for (const booking of bookings) {
      const app = booking.applications[0] ?? null;
      if (booking.assignmentMode === 'OPEN_MARKETPLACE' && booking.status === 'OPEN' && !app) {
        try {
          await this.assertOpenEligibility(this.prisma, booking, profile.id);
        } catch {
          continue;
        }
      }
      if (
        query.status &&
        ['APPLIED', 'SELECTED', 'NOT_SELECTED', 'WITHDRAWN', 'DECLINED', 'EXPIRED'].includes(query.status) &&
        app?.status !== query.status
      )
        continue;
      visible.push(
        booking.assignmentMode === 'OPEN_MARKETPLACE'
          ? this.openBookingResponse(booking, app?.status ?? null, Boolean(app?.status === 'SELECTED'), true)
          : this.technicianJobResponse(this.withHistoricalAddress(booking), userId),
      );
    }
    return { items: visible, total, page: query.page, limit: query.limit };
  }

  async technicianJobDetail(userId: string, id: string) {
    const profile = await this.requireActiveTechnician(userId);
    const booking = await this.detail(userId, id, true, true);
    if (booking.assignmentMode === 'OPEN_MARKETPLACE') {
      if (booking.status === 'OPEN' && booking.applicationDeadlineAt && booking.applicationDeadlineAt <= new Date()) {
        await this.expireOpenBookingIfDue(id);
        const expired = await this.detail(userId, id, true);
        const application = await this.prisma.bookingTechnicianApplication.findUnique({
          where: { bookingId_technicianProfileId: { bookingId: id, technicianProfileId: profile.id } },
        });
        return this.openBookingResponse(expired, application?.status ?? null, false, true);
      }
      const application = await this.prisma.bookingTechnicianApplication.findUnique({
        where: { bookingId_technicianProfileId: { bookingId: id, technicianProfileId: profile.id } },
      });
      if (booking.status === 'EXPIRED' && !application)
        return this.openBookingResponse(booking, 'EXPIRED', false, true);
      if (booking.status === 'OPEN' && !application) await this.assertOpenEligibility(this.prisma, booking, profile.id);
      else if (!application) throw new ForbiddenException('Don khong thuoc ky thuat vien nay');
      return this.openBookingResponse(booking, application?.status ?? null, application?.status === 'SELECTED', true);
    }
    if (booking.technician?.userId !== userId) throw new ForbiddenException('Don khong thuoc ky thuat vien nay');
    return this.technicianJobResponse(booking, userId);
  }

  async technicianJobContact(userId: string, id: string) {
    await this.requireActiveTechnician(userId);
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      select: {
        customerId: true,
        status: true,
        assignmentMode: true,
        technician: { select: { id: true, userId: true } },
        customer: { select: { displayName: true } },
      },
    });
    if (!booking || booking.technician?.userId !== userId) throw new NotFoundException('Don khong ton tai');
    if (!['CONFIRMED', 'COMPLETED'].includes(booking.status))
      throw new ForbiddenException('Chi hien so lien he sau khi da nhan don');
    if (booking.assignmentMode === 'OPEN_MARKETPLACE') {
      const selected = await this.prisma.bookingTechnicianApplication.findFirst({
        where: { bookingId: id, technicianProfileId: booking.technician!.id, status: 'SELECTED' },
        select: { id: true },
      });
      if (!selected) throw new ForbiddenException('KTV chua duoc chon cho don nay');
    }
    const phone = await this.prisma.userIdentity.findFirst({
      where: { userId: booking.customerId, provider: 'PHONE', phoneNumber: { not: null } },
      select: { phoneNumber: true },
    });
    if (!phone?.phoneNumber) throw new NotFoundException('Khach chua co so dien thoai xac thuc');
    return { bookingId: id, displayName: booking.customer.displayName, phoneNumber: phone.phoneNumber };
  }

  async acceptTechnicianJob(userId: string, id: string) {
    await this.detail(userId, id, true);
    const expired = await this.expireDirectBookingIfDue(id);
    if (expired) throw new ConflictException('BOOKING_EXPIRED');
    await this.chargeTechnicianCommission(userId, id);
    return this.updateStatus(userId, id, { status: 'CONFIRMED' });
  }

  private async chargeTechnicianCommission(
    userId: string,
    bookingId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const rate = this.settings ? await this.settings.platformFeePercent() : Number(this.config.get('TECHNICIAN_COMMISSION_RATE_PERCENT', 25));
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new BadRequestException('Ty le chiet khau KTV khong hop le');
    const booking = await db.booking.findFirst({ where: { id: bookingId, technician: { userId } }, select: { grossServiceAmount: true } });
    if (!booking) throw new ForbiddenException('Don khong thuoc KTV nay');
    const fee = Math.round(Number(booking.grossServiceAmount ?? 0) * rate / 100);
    if (fee <= 0) return;
    const debit = async (tx: Prisma.TransactionClient) => {
      const wallet = await tx.wallet.upsert({ where: { userId_type: { userId, type: 'ADVERTISING_CREDIT' } }, create: { userId, type: 'ADVERTISING_CREDIT' }, update: {} });
      const existing = await tx.walletLedgerEntry.findUnique({ where: { referenceType_referenceId: { referenceType: 'BOOKING_COMMISSION', referenceId: bookingId } } });
      if (existing) return;
      const updated = await tx.wallet.updateMany({ where: { id: wallet.id, balanceVnd: { gte: fee } }, data: { balanceVnd: { decrement: fee } } });
      if (!updated.count) throw new ConflictException('So du vi khong du de nhan don');
      const current = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id }, select: { balanceVnd: true } });
      await tx.walletLedgerEntry.create({ data: { walletId: wallet.id, type: 'COMMISSION_DEBIT', amountVnd: -fee, balanceBeforeVnd: current.balanceVnd + fee, balanceAfterVnd: current.balanceVnd, referenceType: 'BOOKING_COMMISSION', referenceId: bookingId } });
      await tx.booking.update({ where: { id: bookingId }, data: { platformFee: fee, technicianEarning: Number(booking.grossServiceAmount ?? 0) - fee, feePolicyVersion: `COMMISSION_${rate}_V1` } });
    };
    if (db === this.prisma) await this.prisma.$transaction(debit);
    else await debit(db);
  }

  async declineTechnicianJob(userId: string, id: string, dto: CancelBookingDto) {
    const booking = await this.detail(userId, id, true);
    if (booking.assignmentMode === 'OPEN_MARKETPLACE') return this.declineOpenJob(userId, id);
    if (booking.technician.userId !== userId) throw new ForbiddenException('Don khong thuoc ky thuat vien nay');
    if (booking.status !== 'PENDING') throw new BadRequestException('Chi co the tu choi don moi');
    return this.cancel(userId, id, dto);
  }

  completeTechnicianJob(userId: string, id: string) {
    return this.updateStatus(userId, id, { status: 'COMPLETED' });
  }

  async cancel(userId: string, id: string, dto: CancelBookingDto) {
    const booking = await this.detail(userId, id, true);
    if (!['OPEN', 'PENDING', 'CONFIRMED'].includes(booking.status))
      throw new BadRequestException('Lich dat khong the huy');
    if (dto.reasonCode === 'OTHER' && !dto.reasonText?.trim())
      throw new BadRequestException('Vui long nhap ly do khac');
    const actor = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const updated = await this.transition(id, booking.status, {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: dto.reasonText ?? dto.reason,
      cancellationReasonCode: dto.reasonCode,
      cancellationReasonText: dto.reasonText,
      cancelledByUserId: userId,
      cancelledByRole: actor?.role,
    });
    if (booking.assignmentMode === 'OPEN_MARKETPLACE' && booking.status === 'OPEN') {
      const applied = await this.prisma.bookingTechnicianApplication.findMany({
        where: { bookingId: id, status: 'APPLIED' },
        include: { technicianProfile: { select: { userId: true } } },
      });
      await this.prisma.bookingTechnicianApplication.updateMany({
        where: { bookingId: id, status: 'APPLIED' },
        data: { status: 'EXPIRED', expiredAt: new Date() },
      });
      for (const application of applied)
        void this.notifyStatus(
          application.technicianProfile.userId,
          id,
          'BOOKING_CANCELLED',
          'Đơn đã bị hủy',
          'Khách hàng đã hủy đơn mà bạn đang ứng tuyển.',
        );
    }
    const technicianUserId = booking.technician?.userId;
    const recipients =
      actor?.role === 'ADMIN'
        ? ([booking.customerId, technicianUserId].filter(Boolean) as string[])
        : ([booking.customerId === userId ? technicianUserId : booking.customerId].filter(Boolean) as string[]);
    for (const recipient of recipients)
      void this.notifyStatus(recipient, id, 'BOOKING_CANCELLED', 'Lịch hẹn đã hủy', 'Một lịch hẹn đã được hủy.');
    return updated;
  }

  /** Idempotent DB-conditional terminal transition. Safe when invoked by many app instances. */
  async expireOpenBookingIfDue(bookingId: string, now = new Date()) {
    const result = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, customerId: true, applicationDeadlineAt: true },
      });
      if (!booking?.applicationDeadlineAt || booking.applicationDeadlineAt > now) return null;
      const claimed = await tx.booking.updateMany({
        where: {
          id: bookingId,
          assignmentMode: 'OPEN_MARKETPLACE',
          status: 'OPEN',
          technicianId: null,
          applicationDeadlineAt: { lte: now },
        },
        data: { status: 'EXPIRED', expiredAt: now },
      });
      if (!claimed.count) return null;
      const applied = typeof tx.bookingTechnicianApplication.findMany === 'function'
        ? await tx.bookingTechnicianApplication.findMany({
            where: { bookingId, status: 'APPLIED' },
            select: { technicianProfile: { select: { userId: true } } },
          })
        : [];
      const applications = await tx.bookingTechnicianApplication.updateMany({
        where: { bookingId, status: 'APPLIED' },
        data: { status: 'EXPIRED', expiredAt: now },
      });
      return {
        customerId: booking.customerId,
        applicationCount: applications.count,
        technicianUserIds: applied.map((item: { technicianProfile: { userId: string } }) => item.technicianProfile.userId),
        deadline: booking.applicationDeadlineAt,
        expiredAt: now,
      };
    });
    if (result) {
      const recipients = [result.customerId, ...result.technicianUserIds];
      for (const recipient of recipients)
        void this.notifyStatus(recipient, bookingId, 'BOOKING_EXPIRED', 'Đơn đã hết hạn', 'Đơn OPEN chưa được chọn KTV trước hạn ứng tuyển.');
    }
    return result;
  }

  /** Moves an unanswered DIRECT booking to the marketplace fallback. */
  async expireDirectBookingIfDue(bookingId: string, now = new Date()) {
    const ttlMinutes = Number(this.config.get('OPEN_BOOKING_APPLICATION_TTL_MINUTES', 15));
    const result = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          customerId: true,
          technicianId: true,
          assignmentMode: true,
          status: true,
          mode: true,
          addressSnapshot: true,
          scheduledStart: true,
          scheduledEnd: true,
          createdAt: true,
          applicationDeadlineAt: true,
          technician: { select: { userId: true } },
          items: { include: { catalogService: true } },
        },
      });
      if (
        !booking ||
        booking.assignmentMode !== 'DIRECT' ||
        booking.status !== 'PENDING' ||
        !booking.technicianId
      )
        return null;
      const deadline =
        booking.applicationDeadlineAt ?? new Date(booking.createdAt.getTime() + ttlMinutes * 60_000);
      if (deadline > now) return null;
      const fallbackDeadline = new Date(now.getTime() + ttlMinutes * 60_000);
      const claimed = await tx.booking.updateMany({
        where: {
          id: bookingId,
          assignmentMode: 'DIRECT',
          status: 'PENDING',
          technicianId: { not: null },
        },
        data: {
          assignmentMode: 'OPEN_MARKETPLACE',
          status: 'OPEN',
          technicianId: null,
          applicationDeadlineAt: fallbackDeadline,
          expiredAt: null,
        },
      });
      if (!claimed.count) return null;
      return {
        customerId: booking.customerId,
        technicianUserId: booking.technician?.userId ?? null,
        excludedTechnicianId: booking.technicianId,
        deadline: fallbackDeadline,
        expiredAt: null,
        booking: {
          id: booking.id,
          assignmentMode: 'OPEN_MARKETPLACE',
          status: 'OPEN',
          technicianId: null,
          mode: (booking as any).mode,
          addressSnapshot: (booking as any).addressSnapshot,
          scheduledStart: (booking as any).scheduledStart,
          scheduledEnd: (booking as any).scheduledEnd,
          applicationDeadlineAt: fallbackDeadline,
          items: booking.items,
        },
      };
    });
    if (result) {
      const recipients = [result.customerId, result.technicianUserId].filter(
        (userId): userId is string => Boolean(userId),
      );
      for (const recipient of recipients)
        void this.notifyStatus(
          recipient,
          bookingId,
          'BOOKING_FALLBACK_OPEN',
          'Đơn đã hết hạn',
          'KTV chưa nhận đơn trong thời hạn 15 phút.',
        );
      void this.notifyEligibleTechniciansForOpenBooking(result.booking, result.excludedTechnicianId ?? undefined);
    }
    return result;
  }

  async updateStatus(userId: string, id: string, dto: UpdateBookingStatusDto) {
    const booking = await this.detail(userId, id, true);
    if (booking.technician?.userId !== userId)
      throw new ForbiddenException('Chi ky thuat vien moi co the cap nhat trang thai');
    const allowed =
      (booking.status === 'PENDING' && dto.status === 'CONFIRMED') ||
      (booking.status === 'CONFIRMED' && dto.status === 'COMPLETED');
    if (!allowed) throw new BadRequestException('Chuyen trang thai khong hop le');
    if (dto.status === 'COMPLETED' && booking.scheduledEnd > new Date()) {
      throw new BadRequestException('Chua den gio ket thuc dich vu');
    }
    const updated = await this.transition(id, booking.status, { status: dto.status });
    const title = dto.status === 'CONFIRMED' ? 'Đặt lịch thành công' : 'Dịch vụ đã hoàn thành';
    void this.notifyStatus(booking.customerId, id, `BOOKING_${dto.status}`, title, title);
    return updated;
  }

  async review(userId: string, id: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, customerId: userId },
      include: { review: true },
    });
    if (!booking) throw new NotFoundException('Lich dat khong ton tai');
    if (booking.status !== 'COMPLETED') throw new BadRequestException('Chi danh gia sau khi hoan thanh dich vu');
    if (booking.review) throw new BadRequestException('Lich dat da duoc danh gia');
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            if (!booking.technicianId) throw new BadRequestException('Don chua duoc gan KTV');
            const review = await tx.review.create({
              data: {
                bookingId: id,
                userId,
                technicianId: booking.technicianId,
                rating: dto.rating,
                comment: dto.comment?.trim() || null,
              },
            });
            const aggregate = await tx.review.aggregate({
              where: { technicianId: booking.technicianId },
              _avg: { rating: true },
              _count: { id: true },
            });
            const reviewCount = typeof aggregate._count === 'number' ? aggregate._count : aggregate._count.id;
            await tx.technicianProfile.update({
              where: { id: booking.technicianId },
              data: { averageRating: aggregate._avg?.rating ?? 0, reviewCount },
            });
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
          },
          { isolationLevel: 'Serializable' },
        );
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
    expectedStatus: 'OPEN' | 'EXPIRED' | 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED',
    data: {
      status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
      cancelledAt?: Date;
      cancellationReason?: string;
      cancellationReasonCode?: 'NO_LONGER_NEEDED' | 'SERVICE_ISSUE' | 'PAYMENT_REFUND_ISSUE' | 'OTHER';
      cancellationReasonText?: string;
      cancelledByUserId?: string;
      cancelledByRole?: 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN';
    },
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
    const profile = await this.prisma.technicianProfile.findFirst({
      where: { userId, isActive: true, isVerified: true, user: { status: 'ACTIVE' } },
      select: { id: true },
    });
    if (!profile) throw new ForbiddenException('Tai khoan KTV chua du dieu kien nhan don');
    return profile;
  }

  private async openJobForTechnician(bookingId: string, technicianProfileId: string, requireEligible: boolean) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { items: { include: { catalogService: true } } },
    });
    if (!booking || booking.assignmentMode !== 'OPEN_MARKETPLACE' || booking.status !== 'OPEN' || booking.technicianId)
      throw new ConflictException('Don khong con mo de ung tuyen');
    if (booking.applicationDeadlineAt && booking.applicationDeadlineAt <= new Date()) {
      await this.expireOpenBookingIfDue(bookingId);
      throw new ConflictException('BOOKING_EXPIRED');
    }
    if (requireEligible) await this.assertOpenEligibility(this.prisma, booking, technicianProfileId);
    return booking;
  }

  /** Rechecked on list, apply and selection. It deliberately permits overlapping applications. */
  private async assertOpenEligibility(
    db: Prisma.TransactionClient | PrismaService,
    booking: any,
    technicianProfileId: string,
  ) {
    if (booking.assignmentMode !== 'OPEN_MARKETPLACE' || booking.status !== 'OPEN')
      throw new ConflictException('Don khong con mo');
    const profile = await db.technicianProfile.findFirst({
      where: {
        id: technicianProfileId,
        isActive: true,
        isVerified: true,
        user: { status: 'ACTIVE', role: 'TECHNICIAN', technicianApplication: { is: { status: 'APPROVED' } } },
      },
      select: { id: true, city: true, district: true, serviceModes: true },
    });
    if (!profile) throw new ForbiddenException('Tai khoan KTV chua du dieu kien nhan don');
    const snapshot =
      booking.addressSnapshot && typeof booking.addressSnapshot === 'object' ? (booking.addressSnapshot as any) : null;
    if (snapshot?.city && profile.city && snapshot.city !== profile.city)
      throw new ForbiddenException('KTV khong phu hop khu vuc cua don');
    if (snapshot?.district && profile.district && snapshot.district !== profile.district)
      throw new ForbiddenException('KTV khong phu hop quan huyen cua don');
    if (!profile.serviceModes.includes(booking.mode))
      throw new ForbiddenException('KTV khong ho tro hinh thuc dich vu nay');
    const unfinished = await db.booking.findFirst({
      where: {
        technicianId: profile.id,
        status: 'CONFIRMED',
        id: { not: booking.id },
      },
      select: { id: true },
    });
    if (unfinished) throw new ConflictException('KTV phai hoan thanh don hien tai truoc khi nhan don moi');
    const catalogItems = (booking.items ?? []).map((item: any) => item.catalogService).filter(Boolean);
    if (!catalogItems.length || catalogItems.length !== (booking.items ?? []).length)
      throw new BadRequestException('Du lieu dich vu OPEN khong hop le');
    for (const catalog of catalogItems) {
      const service = await db.technicianService.findFirst({
        where: {
          technicianId: profile.id,
          isActive: true,
          catalogServiceId: catalog.id,
          categoryId: catalog.categoryId,
          modes: { has: booking.mode },
        },
        select: { id: true },
      });
      if (!service) throw new ForbiddenException('KTV chua co dich vu phu hop voi don nay');
    }
    const available = await db.availabilitySlot.findFirst({
      where: {
        technicianId: profile.id,
        isAvailable: true,
        startAt: { lte: booking.scheduledStart },
        endAt: { gte: booking.scheduledEnd },
      },
      select: { id: true },
    });
    if (!available) throw new ConflictException('KTV khong ranh trong khung gio nay');
    const conflict = await db.booking.findFirst({
      where: {
        technicianId: profile.id,
        status: 'CONFIRMED',
        scheduledStart: { lt: booking.scheduledEnd },
        scheduledEnd: { gt: booking.scheduledStart },
        id: { not: booking.id },
      },
      select: { id: true },
    });
    if (conflict) throw new ConflictException('KTV da co lich trung thoi gian');
  }

  private openBookingResponse(
    booking: any,
    applicationStatus: string | null,
    selected: boolean,
    includeTechnicianPricing = false,
  ) {
    const effectiveApplicationStatus =
      applicationStatus ??
      (booking.assignmentMode === 'OPEN_MARKETPLACE' && booking.status === 'EXPIRED' ? 'EXPIRED' : null);
    const canApply =
      booking.status === 'OPEN' &&
      !effectiveApplicationStatus &&
      (!booking.applicationDeadlineAt || new Date(booking.applicationDeadlineAt) > new Date());
    return {
      bookingId: booking.id,
      id: booking.id,
      assignmentMode: booking.assignmentMode,
      bookingStatus: booking.status,
      applicationStatus: effectiveApplicationStatus,
      scheduledAt: booking.scheduledStart,
      scheduledStart: booking.scheduledStart,
      scheduledEnd: booking.scheduledEnd,
      mode: booking.mode,
      paymentMethod: booking.payment?.method ?? 'CASH',
      durationMinutes: (booking.items ?? []).reduce((sum: number, item: any) => sum + item.durationMinutes, 0),
      subtotal: Number(booking.subtotal),
      serviceFee: Number(booking.serviceFee),
      totalAmount: Number(booking.totalAmount),
      items: (booking.items ?? []).map((item: any) => ({
        catalogServiceId: item.catalogServiceId,
        name: item.serviceName,
        durationMinutes: item.durationMinutes,
        price: Number(item.unitPrice),
      })),
      customer: booking.customer
        ? {
            id: booking.customer.id,
            displayName: booking.customer.displayName,
            avatarUrl: booking.customer.avatarUrl,
            gender: booking.customer.gender ?? null,
            nationality: booking.customer.nationality ?? null,
          }
        : null,
      address: selected || booking.status === 'EXPIRED' ? (booking.addressSnapshot ?? null) : null,
      canApply,
      canDecline: canApply,
      canWithdraw: booking.status === 'OPEN' && effectiveApplicationStatus === 'APPLIED',
      canContact: selected && ['CONFIRMED', 'COMPLETED'].includes(booking.status),
      canCancel: selected && booking.status === 'CONFIRMED',
      canComplete: selected && booking.status === 'CONFIRMED' && new Date(booking.scheduledEnd) <= new Date(),
      customerSelectedAnotherTechnician: effectiveApplicationStatus === 'NOT_SELECTED',
      applicationDeadlineAt: booking.applicationDeadlineAt ?? null,
      expiredAt: booking.expiredAt ?? null,
      ...(includeTechnicianPricing ? { pricing: this.technicianPricing(booking) } : {}),
    };
  }

  private withHistoricalAddress<
    T extends {
      addressSnapshot: Prisma.JsonValue;
      mode: string;
      address?: { id: string; address: string; latitude: unknown; longitude: unknown; label: string | null } | null;
    },
  >(booking: T) {
    if (booking.mode !== 'HOME') return { ...booking, address: null };
    // A snapshot is immutable history. The live relation is used only for legacy rows created
    // before address_snapshot existed, and is projected to the same safe public shape.
    if (
      booking.addressSnapshot &&
      typeof booking.addressSnapshot === 'object' &&
      !Array.isArray(booking.addressSnapshot)
    ) {
      return { ...booking, address: booking.addressSnapshot };
    }
    const legacy = booking.address;
    return {
      ...booking,
      address: legacy
        ? {
            id: legacy.id,
            addressText: legacy.address,
            address: legacy.address,
            latitude: Number(legacy.latitude),
            longitude: Number(legacy.longitude),
            label: legacy.label,
          }
        : null,
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
    // Financial accounting belongs to KTV/admin responses, never customer history.
    const {
      grossServiceAmount,
      platformFee,
      technicianEarning,
      customerPayableAmount,
      feePolicyVersion,
      ...customerSafeBooking
    } = booking;
    return {
      ...customerSafeBooking,
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
      service: booking.items?.[0]
        ? {
            name: booking.items[0].serviceName,
            price: Number(booking.items[0].unitPrice),
            durationMinutes: booking.items[0].durationMinutes,
          }
        : null,
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
      review: booking.review
        ? {
            id: booking.review.id,
            bookingId: booking.review.bookingId,
            rating: booking.review.rating,
            comment: booking.review.comment,
            createdAt: booking.review.createdAt,
          }
        : null,
      cancellation:
        booking.status === 'CANCELLED'
          ? {
              reasonCode: booking.cancellationReasonCode ?? null,
              reasonText: booking.cancellationReasonText ?? booking.cancellationReason ?? null,
              cancelledAt: booking.cancelledAt ?? null,
              cancelledBy: booking.cancelledByRole ?? null,
            }
          : null,
    };
  }

  private technicianJobResponse(booking: any, userId: string) {
    const base = this.historyResponse(booking, userId);
    return {
      ...base,
      jobState: booking.status === 'PENDING' ? 'NEW' : booking.status === 'CONFIRMED' ? 'ACCEPTED' : booking.status,
      canAccept: booking.status === 'PENDING',
      canDecline: booking.status === 'PENDING',
      canComplete: booking.status === 'CONFIRMED' && new Date(booking.scheduledEnd) <= new Date(),
      customer: booking.customer
        ? {
            id: booking.customer.id,
            displayName: booking.customer.displayName,
            avatarUrl: booking.customer.avatarUrl,
            gender: booking.customer.gender ?? null,
            nationality: booking.customer.nationality ?? null,
          }
        : null,
      pricing: this.technicianPricing(booking),
    };
  }

  private technicianPricing(booking: any) {
    return {
      grossServiceAmount:
        booking.grossServiceAmount === null || booking.grossServiceAmount === undefined
          ? null
          : Number(booking.grossServiceAmount),
      platformFee:
        booking.platformFee === null || booking.platformFee === undefined ? null : Number(booking.platformFee),
      technicianEarning:
        booking.technicianEarning === null || booking.technicianEarning === undefined
          ? null
          : Number(booking.technicianEarning),
      currency: 'VND',
    };
  }

  private async validPromotion(userId: string, code: string, subtotal: number, db: Prisma.TransactionClient) {
    const now = new Date();
    const promotion = await db.promotion.findFirst({
      where: {
        code: code.trim().toUpperCase(),
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
        OR: [{ recipients: { none: {} } }, { recipients: { some: { userId } } }],
      },
    });
    if (!promotion) throw new BadRequestException('Ma khuyen mai khong hop le hoac da het han');
    if (subtotal < Number(promotion.minOrderAmount))
      throw new BadRequestException('Don hang chua dat gia tri toi thieu');
    const userUses = await db.promotionUsage.count({ where: { promotionId: promotion.id, userId } });
    if (
      userUses >= promotion.perUserLimit ||
      (promotion.usageLimit !== null && promotion.usedCount >= promotion.usageLimit)
    )
      throw new BadRequestException('Ma khuyen mai da het luot su dung');
    return promotion;
  }

  private discount(
    promotion: { type: string; value: unknown; maxDiscount: unknown },
    subtotal: number,
    serviceFee: number,
  ) {
    let value = promotion.type === 'PERCENT' ? (subtotal * Number(promotion.value)) / 100 : Number(promotion.value);
    if (promotion.maxDiscount !== null) value = Math.min(value, Number(promotion.maxDiscount));
    return Math.min(subtotal + serviceFee, Math.max(0, Math.round(value)));
  }

  private async notifyBookingCreated(customerId: string, technicianUserId: string, bookingId: string) {
    const template = await this.notifications.getTemplate('BOOKING_CREATED');
    const title = template?.title ?? '[Thông báo Psyocore]';
    const body = template?.body ?? 'Khách mới đã đặt lịch. KTV vui lòng thu tiền trước khi làm.';
    await this.notifications.create(technicianUserId, 'BOOKING_CREATED', title, body, `matxa://bookings/${bookingId}`);
    await this.notifications.sendPush(technicianUserId, title, body, {
      type: 'BOOKING_CREATED',
      bookingId,
      customerId,
    });
  }

  private async notifyEligibleTechniciansForOpenBooking(booking: any, excludedTechnicianId?: string) {
    try {
      const candidates = await this.prisma.technicianProfile.findMany({
        where: {
          ...(excludedTechnicianId ? { id: { not: excludedTechnicianId } } : {}),
          isActive: true,
          isVerified: true,
          user: { status: 'ACTIVE', role: 'TECHNICIAN', technicianApplication: { is: { status: 'APPROVED' } } },
        },
        select: { id: true, userId: true },
      });
      await Promise.all(candidates.map(async (candidate) => {
        try {
          await this.assertOpenEligibility(this.prisma, booking, candidate.id);
          await this.notifyStatus(
            candidate.userId,
            booking.id,
            'OPEN_BOOKING_AVAILABLE',
            'Có đơn mới phù hợp',
            'Có đơn dịch vụ mới phù hợp. Hãy mở tab Nhận việc để xem và ứng tuyển.',
          );
        } catch (error) {
          // One ineligible technician must not block other notifications, but
          // keep the reason visible in server logs for operations debugging.
          this.logger.debug(
            `Bo qua thong bao OPEN_BOOKING_AVAILABLE cho KTV ${candidate.id}: ${error instanceof Error ? error.message : 'khong ro ly do'}`,
          );
        }
      }));
    } catch (error) {
      // Notification delivery must not affect successful booking creation.
      this.logger.warn(
        `Khong the quet KTV phu hop cho booking mo ${booking.id}: ${error instanceof Error ? error.message : 'khong ro ly do'}`,
      );
    }
  }

  private async notifyStatus(userId: string, bookingId: string, type: string, title: string, body: string) {
    let effectiveTitle = title;
    let effectiveBody = body;
    try {
      const template = await this.notifications.getTemplate(type);
      if (template?.isActive) {
        effectiveTitle = template.title;
        effectiveBody = template.body;
      }
    } catch (error) {
      this.logger.warn(`Khong doc duoc mau thong bao ${type}: ${error instanceof Error ? error.message : 'khong ro ly do'}`);
    }
    try {
      await this.notifications.create(userId, type, effectiveTitle, effectiveBody, `matxa://bookings/${bookingId}`);
    } catch (error) {
      this.logger.warn(`Khong tao duoc thong bao trong app ${type}: ${error instanceof Error ? error.message : 'khong ro ly do'}`);
    }
    try {
      await this.notifications.sendPush(userId, effectiveTitle, effectiveBody, { type, bookingId });
    } catch (error) {
      // FCM failure must not remove the in-app notification or fail booking creation.
      this.logger.warn(`Khong gui duoc push ${type}: ${error instanceof Error ? error.message : 'khong ro ly do'}`);
    }
  }
}
