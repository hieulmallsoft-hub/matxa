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
import { refundBookingCommission } from './booking-commission-refund';
import { applyPriceOptions, loadBookableServices } from '../../marketplace/services/technician-selection';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { MarketplaceRealtimeService } from '../../marketplace/services/marketplace-realtime.service';
import { VnpayService } from './vnpay.service';
import { PlatformFeePolicyService } from './platform-fee-policy.service';
import { PayosService } from './payos.service';
import { Optional } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import { ComplaintStorageService } from './complaint-storage.service';
import { addressPreview, confirmationDeadline, kmBetween, roundVnd, technicianBadge, travelFeeFor } from './distance';
import { activityPeriods } from './technician-activity';
import { releaseBookingPromotion } from './booking-promotion-release';
import { creditBookingPromotion } from './booking-promotion-credit';
import { activeSuspension, applyCancelLimit, assertNotSuspended, cancelLimitStatus, isPenalizedCancel } from './cancel-limit';
import { resolveLocationCodes } from '../../marketplace/services/location-code';
import { createRefund, isAwaitingPayment, isPrepaid, recordTechnicianEarning } from './online-payment';
import { COMPLAINT_STATUS_LABEL, complaintStatusEvent, ensureComplaintConversation } from './complaint-conversation';
import {
  BookingHistoryQueryDto,
  CancelBookingDto,
  CreateBookingDto,
  CreateOpenBookingDto,
  CreateReviewDto,
  CreateComplaintDto,
  QuoteBookingDto,
  TechnicianJobQueryDto,
  UpdateBookingStatusDto,
} from '../dto/booking.dto';

/** A complaint needs a technician on the booking: in progress (e.g. "KTV không đến"), done, or cancelled. */
const COMPLAINABLE_STATUSES: string[] = ['CONFIRMED', 'COMPLETED', 'CANCELLED'];
const COMPLAINT_REASON_LABEL: Record<string, string> = {
  SERVICE_ISSUE: 'Vấn đề về dịch vụ',
  TECHNICIAN_NO_CONTACT: 'KTV không liên hệ, không đến',
  TECHNICIAN_BEHAVIOR: 'Thái độ của KTV',
  SAFETY_ISSUE: 'Vấn đề an toàn',
  PAYMENT_ISSUE: 'Thanh toán',
  CUSTOMER_NO_SHOW: 'Khách không có mặt, không liên lạc được',
  CUSTOMER_BEHAVIOR: 'Thái độ của khách',
  OTHER: 'Lý do khác',
};
/** What the complaint chat header needs: the booking, its items and the booked technician. */
const COMPLAINT_CONTEXT_INCLUDE = {
  evidence: { select: { id: true } },
  customer: { select: { id: true, displayName: true, avatarUrl: true } },
  booking: {
    select: {
      id: true, status: true, mode: true, scheduledStart: true, scheduledEnd: true, totalAmount: true, addressSnapshot: true,
      payment: { select: { method: true } },
      items: { select: { serviceName: true, durationMinutes: true, unitPrice: true } },
      technician: { select: { averageRating: true, reviewCount: true, user: { select: { displayName: true, avatarUrl: true } } } },
      customer: { select: { displayName: true, avatarUrl: true } },
    },
  },
} as const;

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
    private readonly complaintStorage?: ComplaintStorageService,
  ) {}

  async quote(userId: string, dto: QuoteBookingDto, db: Prisma.TransactionClient = this.prisma) {
    await this.assertCustomer(userId, dto.technicianId);
    await this.assertModeEnabled(dto.mode);
    await this.assertLeadTime(new Date(dto.scheduledStart));
    const baseServices = await loadBookableServices(db, dto.technicianId, dto.serviceIds, dto.mode);
    const services = await applyPriceOptions(db, baseServices, dto.priceOptionIds);
    const durationMinutes = services.reduce((sum, item) => sum + item.durationMinutes, 0);
    const scheduledStart = new Date(dto.scheduledStart);
    const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60_000);
    if (!Number.isFinite(scheduledStart.getTime()) || scheduledStart <= new Date())
      throw new BadRequestException('Thời gian đặt lịch phải ở tương lai');
    if (dto.mode !== 'HOME' && dto.addressId) throw new BadRequestException('Chỉ gửi addressId khi đặt tại nhà');
    const slot = await db.availabilitySlot.findFirst({
      where: {
        technicianId: dto.technicianId,
        isAvailable: true,
        startAt: { lte: scheduledStart },
        endAt: { gte: scheduledEnd },
      },
    });
    if (!slot) throw new BadRequestException('Kỹ thuật viên không rảnh trong khung giờ này');
    const conflict = await db.booking.findFirst({
      where: {
        technicianId: dto.technicianId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        scheduledStart: { lt: scheduledEnd },
        scheduledEnd: { gt: scheduledStart },
      },
      select: { id: true },
    });
    if (conflict) throw new BadRequestException('Khung giờ đã có người đặt');
    let addressSnapshot: {
      id: string;
      addressText: string;
      address: string;
      latitude: number;
      longitude: number;
      label: string | null;
      phone: string | null;
      note: string | null;
    } | null = null;
    if (dto.mode === 'HOME') {
      if (!dto.addressId) throw new BadRequestException('Đặt tại nhà cần chọn địa chỉ');
      const address = await db.address.findFirst({
        where: { id: dto.addressId, userId, deletedAt: null },
        select: { id: true, address: true, phone: true, note: true, latitude: true, longitude: true, label: true },
      });
      if (!address) throw new BadRequestException('Địa chỉ không hợp lệ');
      addressSnapshot = {
        id: address.id,
        addressText: address.address,
        address: address.address,
        latitude: Number(address.latitude),
        longitude: Number(address.longitude),
        label: address.label,
        phone: address.phone,
        note: address.note,
      };
    }
    const subtotal = services.reduce((sum, item) => sum.plus(item.price), new Prisma.Decimal(0)).toNumber();
    const serviceFee = dto.mode === 'HOME' ? (await this.bookingRules()).homeServiceFee : 0;
    const rules = await this.bookingRules();
    // Only look the technician up when a travel fee is configured at all.
    const technicianLocation = addressSnapshot && rules.travelFeeAmount > 0
      ? await db.technicianProfile.findUnique({ where: { id: dto.technicianId }, select: { latitude: true, longitude: true } })
      : null;
    const travelDistanceKm = technicianLocation ? kmBetween(addressSnapshot, technicianLocation) : null;
    const travelFee = travelFeeFor(dto.mode, travelDistanceKm, rules);
    if (!Number.isFinite(serviceFee) || serviceFee < 0)
      throw new BadRequestException('Phí dịch vụ chưa được cấu hình hợp lệ');
    const promotion = dto.promotionCode ? await this.validPromotion(userId, dto.promotionCode, subtotal, db) : null;
    // A promotion is validated against the service subtotal, but its discount can
    // never make the payable amount negative (including the HOME service fee).
    const discountAmount = promotion ? this.discount(promotion, subtotal, serviceFee) : 0;
    const totalAmount = Prisma.Decimal.max(
      0,
      new Prisma.Decimal(subtotal).plus(serviceFee).plus(travelFee).minus(discountAmount),
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
      travelFee,
      travelDistanceKm,
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
      // The home surcharge and travel fee go to the technician in full; the commission is only taken on the services.
      technicianEarning: financials.technicianEarning.toNumber() + serviceFee + travelFee,
      customerPayableAmount: totalAmount,
      feePolicyVersion: financials.feePolicyVersion,
    };
  }

  async create(userId: string, dto: CreateBookingDto) {
    const acceptanceDeadlineAt = new Date(Date.now() + (await this.bookingRules()).confirmationWaitMinutes * 60_000);
    try {
      const booking = await this.prisma.$transaction(
        async (tx) => {
          // Same domain/pricing validation as quote, re-run inside the write transaction.
          const quote = await this.quote(userId, dto, tx);
          if (quote.promotionId) await this.reservePromotion(tx, quote.promotionId, quote.promotionUsageLimit);
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
              travelFee: quote.travelFee,
              travelDistanceKm: quote.travelDistanceKm,
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
        throw new ConflictException('Dữ liệu đặt lịch vừa thay đổi, vui lòng thử lại');
      const databaseError = error as { code?: string; meta?: { constraint?: string }; message?: string };
      if (
        (databaseError.code === 'P2004' && databaseError.meta?.constraint === 'bookings_no_active_overlap') ||
        databaseError.message?.includes('bookings_no_active_overlap') ||
        databaseError.message?.includes('could not serialize')
      ) {
        throw new ConflictException({
          code: 'SLOT_UNAVAILABLE',
          message: 'Khung giờ vừa được người khác đặt, vui lòng chọn giờ khác',
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
    if (!payment) throw new NotFoundException('Thanh toán không tồn tại');
    if (payment.method !== 'ONLINE') throw new BadRequestException('Đơn không dùng thanh toán online');
    if (payment.status === 'PAID') return { bookingId, paymentId: payment.id, status: 'PAID', paymentUrl: null };
    const ttlMinutes = Number(this.config.get('VNPAY_PAYMENT_TTL_MINUTES', 15));
    if (!Number.isInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > 60)
      throw new BadRequestException('VNPAY_PAYMENT_TTL_MINUTES khong hop le');
    const expiresAt = (await this.paymentWindow(bookingId)) ?? new Date(Date.now() + ttlMinutes * 60_000);
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
        orderInfo: `PSYOCORE ${bookingId}`,
        ipAddress,
        expiresAt,
      }),
    };
  }

  async createPayosPayment(userId: string, bookingId: string) {
    if (!this.payos?.isConfigured()) throw new BadRequestException('PayOS chưa được cấu hình');
    const payment = await this.prisma.payment.findFirst({ where: { bookingId, booking: { customerId: userId } } });
    if (!payment) throw new NotFoundException('Thanh toán không tồn tại');
    if (payment.method !== 'ONLINE') throw new BadRequestException('Đơn không dùng thanh toán online');
    if (payment.status === 'PAID') return { bookingId, paymentId: payment.id, status: 'PAID', paymentUrl: null };
    // A link was opened before: it may already be paid (the webhook got lost). Otherwise close it, so money cannot
    // arrive on a link nobody is waiting on any more.
    if (payment.provider === 'PAYOS' && payment.providerRef) {
      if ((await this.syncPayosPayment(bookingId)) === 'PAID')
        return { bookingId, paymentId: payment.id, status: 'PAID', paymentUrl: null };
      await this.payos.cancelPaymentLink(payment.providerRef).catch(() => undefined);
    }
    const expiresAt = (await this.paymentWindow(bookingId)) ?? new Date(Date.now() + Number(this.config.get('PAYOS_PAYMENT_TTL_MINUTES', 15)) * 60_000);
    const orderCode = Number(
      `${Date.now()}${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0')}`,
    );
    const data = await this.payos.createPaymentLink({
      orderCode,
      amount: Number(payment.amount),
      description: `PSYOCORE ${bookingId.slice(0, 8)}`,
      reference: payment.id,
      expiredAt: Math.floor(expiresAt.getTime() / 1000),
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
    if (!this.payos) throw new BadRequestException('PayOS chưa được cấu hình');
    const data = this.payos.verifyWebhook({
      signature: body.signature as string | undefined,
      data: body.data as Record<string, string | number | boolean | null | undefined> | undefined,
    });
    const orderCode = String(data.orderCode ?? '');
    const payment = await this.prisma.payment.findFirst({ where: { provider: 'PAYOS', providerRef: orderCode } });
    // Not a booking payment (a wallet top-up, or PayOS's sample event when the webhook URL is saved): nothing here.
    if (!payment) return { code: '00', desc: 'success', handled: false };
    if (Number(data.amount) !== Number(payment.amount))
      throw new BadRequestException('Số tiền webhook PayOS không khớp');
    const success = String(body.code ?? '') === '00' && body.success === true;
    await this.recordPayosResult(payment, success, data, String(body.code ?? ''));
    return { code: '00', desc: 'success', handled: true };
  }

  /** Writes what PayOS reported (webhook or a status check) once; a payment counts as paid only once. */
  private async recordPayosResult(
    payment: { id: string; bookingId: string },
    success: boolean,
    data: Record<string, unknown>,
    responseCode: string,
  ) {
    const text = (value: unknown) => (value === undefined || value === null || value === '' ? null : String(value));
    const updated = await this.prisma.payment.updateMany({
      where: { id: payment.id, status: { in: ['PENDING', 'UNPAID'] } },
      data: {
        status: success ? 'PAID' : 'FAILED',
        providerTransactionNo: text(data.reference),
        responseCode,
        ipnReceivedAt: new Date(),
        ...(success ? { paidAt: new Date() } : {}),
        // The account the customer paid from: where a refund would go back to.
        payerBankBin: text(data.counterAccountBankId),
        payerBankName: text(data.counterAccountBankName),
        payerAccountNumber: text(data.counterAccountNumber),
        payerAccountName: text(data.counterAccountName),
      },
    });
    if (success && updated.count) await this.afterPaymentPaid(payment.bookingId);
    return updated.count > 0;
  }

  /**
   * Asks PayOS whether a booking's open payment link was paid, for when the webhook never came. Returns the payment
   * status afterwards ('PAID', 'PENDING', ...) or null when there is nothing to check.
   */
  async syncPayosPayment(bookingId: string) {
    return (await this.checkWithPayos(bookingId)).paymentStatus;
  }

  /** Same check, with what PayOS answered (shown to the admin, so a mismatch can be seen rather than guessed). */
  async checkWithPayos(bookingId: string) {
    const payment = await this.prisma.payment.findFirst({ where: { bookingId } });
    if (!payment) return { paymentStatus: null, orderCode: null, payos: null };
    const orderCode = payment.providerRef;
    if (payment.status === 'PAID' || payment.provider !== 'PAYOS' || !orderCode || !this.payos?.isConfigured())
      return { paymentStatus: payment.status, orderCode, payos: null };
    let answer: Awaited<ReturnType<PayosService['getPaymentInfo']>>;
    try {
      answer = await this.payos.getPaymentInfo(orderCode);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'khong ro';
      this.logger.warn(`Khong hoi duoc PayOS cho don ${bookingId}: ${message}`);
      return { paymentStatus: payment.status, orderCode, payos: { error: message } };
    }
    const info = answer.data;
    const payos = { code: answer.code, desc: answer.desc, status: info?.status ?? null, amount: info?.amount ?? null, amountPaid: info?.amountPaid ?? null };
    if (answer.code !== '00') this.logger.warn(`PayOS tra loi ${answer.code} ${answer.desc} cho don ${bookingId} (orderCode ${orderCode})`);
    const paid = info?.status === 'PAID' && Number(info.amountPaid ?? info.amount) >= Number(payment.amount);
    if (!paid) return { paymentStatus: payment.status, orderCode, payos };
    await this.recordPayosResult(payment, true, info?.transactions?.[0] ?? {}, '00');
    return { paymentStatus: 'PAID', orderCode, payos };
  }

  /** Customer-facing check (the app calls it on return from PayOS, or a "đã thanh toán?" button). */
  async checkPayosPayment(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, customerId: userId }, select: { id: true } });
    if (!booking) throw new NotFoundException('Đơn không tồn tại');
    return { bookingId, paymentStatus: await this.syncPayosPayment(bookingId) };
  }

  /** On return from the PayOS page the order code is in the URL: check it right away, never block the redirect. */
  async syncPayosOrder(orderCode: string | undefined) {
    if (!orderCode) return;
    try {
      const payment = await this.prisma.payment.findFirst({ where: { provider: 'PAYOS', providerRef: orderCode }, select: { bookingId: true } });
      if (payment) await this.syncPayosPayment(payment.bookingId);
    } catch {
      // the redirect matters more; the webhook or a later check still settles it
    }
  }

  payosMobileRedirect(kind: 'return' | 'cancel', query: Record<string, string | undefined>) {
    if (!this.payos) throw new BadRequestException('PayOS chưa được cấu hình');
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
    if (updated.count) await this.afterPaymentPaid(payment.bookingId);
    return updated.count
      ? { RspCode: '00', Message: 'Confirm Success' }
      : { RspCode: '02', Message: 'Order already confirmed' };
  }

  /**
   * A prepaid online booking can only be paid while a technician holds it (until `paymentDeadlineAt`); the payment link
   * expires with it. Returns that deadline, or null for other bookings (their own payment window applies).
   */
  private async paymentWindow(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true, mode: true, paymentDeadlineAt: true, payment: { select: { method: true, status: true } } },
    });
    if (!booking || !isPrepaid(booking)) return null;
    if (booking.status === 'OPEN')
      throw new ConflictException({ statusCode: 409, code: 'PAYMENT_NOT_OPEN', message: 'Chưa có KTV nhận đơn, chưa cần thanh toán' });
    if (!isAwaitingPayment(booking) || booking.paymentDeadlineAt! <= new Date())
      throw new ConflictException({ statusCode: 409, code: 'PAYMENT_NOT_OPEN', message: 'Đơn đã hết hạn thanh toán hoặc không còn hiệu lực' });
    return booking.paymentDeadlineAt!;
  }

  /**
   * What completing a booking settles, by hand or automatically. Cash booking: the platform pays back the voucher to
   * the technician's wallet. Paid online booking: the technician's share (price minus commission) is recorded for the
   * admin to pay out; the platform already holds the money, so no voucher credit.
   */
  async settleCompleted(tx: Prisma.TransactionClient, bookingId: string) {
    const earning = await recordTechnicianEarning(tx, bookingId, (gross, technicianUserId) => this.commissionFor(gross, technicianUserId));
    if (!earning) await creditBookingPromotion(tx, bookingId);
  }

  /**
   * The customer did not pay a prepaid online booking in time: it is cancelled as the customer's cancel (it counts
   * toward their cancel limit), the technician is freed and told about other open jobs.
   */
  async cancelUnpaidBooking(bookingId: string, now = new Date()) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, customerId: true, status: true, paymentDeadlineAt: true, technician: { select: { userId: true } }, payment: { select: { status: true } } },
    });
    if (!booking || booking.status !== 'CONFIRMED' || !booking.paymentDeadlineAt || booking.paymentDeadlineAt > now || booking.payment?.status === 'PAID')
      return false;
    // The customer may have paid and only the webhook got lost: never cancel a paid booking for non-payment.
    if ((await this.syncPayosPayment(bookingId)) === 'PAID') return false;
    const cancelled = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.booking.updateMany({
        where: { id: bookingId, status: 'CONFIRMED', payment: { is: { status: { not: 'PAID' } } } },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancellationReason: 'Khách không thanh toán đúng hạn',
          cancellationReasonCode: 'PAYMENT_NOT_RECEIVED',
          cancelledByUserId: booking.customerId,
          cancelledByRole: 'CUSTOMER',
          cancelPenalized: true,
        },
      });
      if (!claimed.count) return false;
      await refundBookingCommission(tx, bookingId);
      await releaseBookingPromotion(tx, bookingId);
      return true;
    });
    if (!cancelled) return false;
    await this.applyCancelLimit(booking.customerId);
    void this.notifyStatus(booking.customerId, bookingId, 'BOOKING_CANCELLED', 'Đơn đã hủy do chưa thanh toán', 'Bạn chưa thanh toán đúng hạn nên đơn đã tự hủy.');
    if (booking.technician) {
      void this.notifyStatus(booking.technician.userId, bookingId, 'BOOKING_CANCELLED', 'Khách không thanh toán', 'Khách không thanh toán đúng hạn nên đơn đã hủy. Bạn có thể nhận đơn khác.');
      void this.announceOpenJobsToFreedTechnician(booking.technician.userId);
    }
    return true;
  }

  /** Payment received: the technician can start; money that arrived after the booking ended goes back to the customer. */
  async afterPaymentPaid(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true, mode: true, customerId: true, technician: { select: { userId: true } }, payment: { select: { method: true } } },
    });
    if (!booking || !isPrepaid(booking)) return;
    if (booking.status === 'CONFIRMED') {
      if (booking.technician)
        void this.notifyStatus(booking.technician.userId, bookingId, 'BOOKING_PAID', 'Khách đã thanh toán', 'Khách đã thanh toán. Bạn có thể nhắn tin và bắt đầu buổi tư vấn.');
      void this.notifyStatus(booking.customerId, bookingId, 'BOOKING_PAID', 'Thanh toán thành công', 'Đơn đã được xác nhận. Bạn có thể nhắn tin với KTV.');
      return;
    }
    // Paid too late (the booking was cancelled meanwhile): refund in full.
    if (['CANCELLED', 'EXPIRED'].includes(booking.status))
      await createRefund(this.prisma, bookingId, { reason: 'Khách thanh toán sau khi đơn đã hủy', feePercent: 0 });
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
    await this.assertCustomer(userId);
    await this.assertModeEnabled(dto.mode);
    const start = new Date(dto.scheduledStart);
    if (!Number.isFinite(start.getTime()) || start <= new Date()) throw new BadRequestException('Thời gian đặt lịch không hợp lệ');
    await this.assertLeadTime(start);
    const rules = await this.bookingRules();
    const { maxDispatchRadiusKm } = rules;
    // Online work does not depend on where either side is; elsewhere the area must be a known city/ward code.
    const online = dto.mode === 'ONLINE';
    const place = online ? { city: undefined, district: undefined } : await resolveLocationCodes(this.prisma, dto.city, dto.district);
    const serviceIds: string[] = [...new Set((dto.items ?? []).map((item: any) => String(item.catalogServiceId)))] as string[];
    const optionIds: string[] = [...new Set((dto.items ?? []).map((item: any) => String(item.priceOptionId)))] as string[];
    if (!serviceIds.length || serviceIds.length !== (dto.items ?? []).length) throw new BadRequestException('Danh sách dịch vụ không hợp lệ');
    const [services, options] = await Promise.all([
      this.prisma.serviceCatalogItem.findMany({ where: { id: { in: serviceIds }, isActive: true }, include: { category: true } }),
      this.prisma.serviceCatalogPriceOption.findMany({ where: { id: { in: optionIds }, isActive: true } }),
    ]);
    if (services.length !== serviceIds.length || options.length !== optionIds.length) throw new BadRequestException('Dịch vụ hoặc gói giá không hợp lệ');
    const duration = dto.items.reduce((sum: number, item: any) => sum + (options.find((option: any) => option.id === item.priceOptionId)?.durationMinutes ?? 0), 0);
    const end = new Date(start.getTime() + duration * 60_000);
    const candidates: any[] = await this.prisma.technicianProfile.findMany({
      where: {
        isActive: true,
        isVerified: true,
        city: place.city ?? undefined,
        ...(place.district ? { district: place.district } : {}),
        serviceModes: { has: dto.mode },
        // At a facility the customer must know where to go: technicians without one are not suggested.
        ...(dto.mode === 'ONSITE' ? { AND: [{ OR: [{ facility: { not: null } }, { address: { not: null } }] }] } : {}),
        // A technician booking for themselves never sees their own profile among the candidates.
        user: { id: { not: userId }, status: 'ACTIVE', role: 'TECHNICIAN', ...(dto.search ? { displayName: { contains: dto.search, mode: 'insensitive' } } : {}), technicianApplication: { is: { status: 'APPROVED' } } },
        services: { some: { isActive: true, catalogServiceId: { in: serviceIds }, modes: { has: dto.mode } } },
      },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    });
    const location = dto.latitude !== undefined && dto.longitude !== undefined
      ? { latitude: dto.latitude, longitude: dto.longitude }
      : dto.mode === 'HOME' && dto.addressId
        ? await this.prisma.address.findFirst({ where: { id: dto.addressId, userId, deletedAt: null }, select: { latitude: true, longitude: true } }).then((a) => a && { latitude: Number(a.latitude), longitude: Number(a.longitude) })
        : null;
    const distanceKm = (latitude: unknown, longitude: unknown) => kmBetween(location, { latitude, longitude });
    const eligible = [] as any[];
    for (const candidate of candidates) {
      const [slot, conflict, matchingServices] = await Promise.all([
        this.prisma.availabilitySlot.findFirst({ where: { technicianId: candidate.id, isAvailable: true, startAt: { lte: start }, endAt: { gte: end } } }),
        // One unfinished confirmed booking at a time (same rule as assertOpenEligibility), whatever its hour.
        // …and not while they are being served themselves as a customer.
        this.prisma.booking.findFirst({ where: { OR: [{ status: 'CONFIRMED', technicianId: candidate.id }, unfinishedAsCustomer(candidate.userId)] }, select: { id: true } })
          .then(async (busy) => busy ?? (await activeSuspension(this.prisma, candidate.userId))),
        this.prisma.technicianService.findMany({ where: { technicianId: candidate.id, isActive: true, catalogServiceId: { in: serviceIds }, modes: { has: dto.mode } }, select: { catalogServiceId: true, categoryId: true } }),
      ]);
      const hasAllServices = services.every((service: any) => matchingServices.some((item: any) => item.catalogServiceId === service.id && item.categoryId === service.categoryId));
      if (!slot || conflict || !hasAllServices) continue;
      const distance = distanceKm(candidate.latitude, candidate.longitude);
      if (!online && maxDispatchRadiusKm > 0 && distance !== null && distance > maxDispatchRadiusKm) continue;
       eligible.push({ technicianId: candidate.id, displayName: candidate.user.displayName, avatarUrl: candidate.user.avatarUrl, city: candidate.city, district: candidate.district, distanceKm: distance, travelFee: travelFeeFor(dto.mode, distance, rules), rating: Number(candidate.averageRating), reviewCount: candidate.reviewCount });
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
    await this.assertCustomer(userId, dto.technicianId);
    const serviceIds = dto.items.map((item: any) => item.catalogServiceId);
    const catalogOptions = await this.prisma.serviceCatalogPriceOption.findMany({ where: { id: { in: dto.items.map((item: any) => item.priceOptionId) }, isActive: true } });
    const selected = await this.prisma.technicianService.findMany({ where: { technicianId: dto.technicianId, catalogServiceId: { in: serviceIds }, isActive: true }, include: { priceOptions: { where: { isActive: true } } } });
    if (selected.length !== serviceIds.length) throw new BadRequestException('KTV không có dịch vụ phù hợp');
    // The chosen technician's own package of the same length: the one /quote priced and the customer saw.
    const technicianPrices = dto.items.map((item: any) => {
      const service = selected.find((candidate: any) => candidate.catalogServiceId === item.catalogServiceId)!;
      const catalogOption = catalogOptions.find((candidate: any) => candidate.id === item.priceOptionId);
      if (!catalogOption) throw new BadRequestException('Gói giá không hợp lệ hoặc đã ngừng hoạt động');
      const option = service.priceOptions.find((candidate: any) => candidate.durationMinutes === catalogOption.durationMinutes);
      // A technician without packages sells the service at its own base length and price.
      if (!option && (service.priceOptions.length || service.durationMinutes !== catalogOption.durationMinutes))
        throw new BadRequestException(`KTV không có gói ${catalogOption.durationMinutes} phút cho dịch vụ này`);
      return { serviceId: service.id as string, priceOptionId: (option?.id ?? null) as string | null };
    });
    // A technician selected in the first screen is the customer's preferred
    // technician, not a final assignment. Keep the booking open so every
    // other eligible technician receives the same opportunity to apply. The
    // customer finalizes the assignment later through select-technician.
    const { technicianId, ...openDto } = dto;
    return this.createOpen(userId, openDto as CreateOpenBookingDto, technicianId, technicianPrices);
  }

  /**
   * A customer has one booking in progress at a time: while one is waiting for a technician (OPEN, or a legacy direct
   * PENDING, before its deadline) or taken but not finished (CONFIRMED), a new one is refused with 409
   * BOOKING_ALREADY_WAITING. Runs in the creating transaction behind a per-customer lock so two taps at once cannot
   * both get through.
   */
  private async assertNoWaitingBooking(tx: Prisma.TransactionClient, customerId: string, lock = true) {
    if (lock) await tx.$queryRaw(Prisma.sql`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${customerId}))) AS locked`);
    const waiting = await tx.booking.findFirst({
      where: unfinishedAsCustomer(customerId),
      select: { id: true, status: true },
      orderBy: { createdAt: 'desc' },
    });
    if (waiting)
      throw new ConflictException({
        code: 'BOOKING_ALREADY_WAITING',
        message:
          waiting.status === 'CONFIRMED'
            ? 'Bạn đang có đơn chưa hoàn thành. Vui lòng hoàn thành hoặc hủy đơn đó trước khi đặt đơn mới'
            : 'Bạn đang có đơn chờ KTV nhận. Vui lòng đợi hoặc hủy đơn đó trước khi đặt đơn mới',
        bookingId: waiting.id,
        bookingStatus: waiting.status,
        bookingRole: 'CUSTOMER',
      });
    // A technician account booking as a customer: one unfinished thing at a time, so not while a job it took is open.
    const job = await tx.booking.findFirst({
      where: { status: 'CONFIRMED', technician: { is: { userId: customerId } } },
      select: { id: true, status: true },
      orderBy: { scheduledStart: 'asc' },
    });
    if (job)
      throw new ConflictException({
        code: 'BOOKING_ALREADY_WAITING',
        message: 'Bạn đang có việc KTV chưa hoàn thành. Vui lòng hoàn thành việc đó trước khi đặt đơn mới',
        bookingId: job.id,
        bookingStatus: job.status,
        bookingRole: 'TECHNICIAN',
      });
  }

  /** The chosen technician's prices for these services, computed exactly as /quote does. */
  private async technicianPrices(technicianId: string, mode: any, picks: Array<{ serviceId: string; priceOptionId: string | null }>) {
    const services = await loadBookableServices(this.prisma, technicianId, picks.map((pick) => pick.serviceId), mode);
    return Promise.all(
      services.map(async (service, index) => {
        const [priced] = await applyPriceOptions(this.prisma, [service], picks[index].priceOptionId ? [picks[index].priceOptionId!] : undefined);
        return priced;
      }),
    );
  }

  async createOpen(
    userId: string,
    dto: CreateOpenBookingDto,
    requestedTechnicianId?: string,
    requestedPrices?: Array<{ serviceId: string; priceOptionId: string | null }>,
  ) {
    await this.assertCustomer(userId);
    // Checked first so the customer gets BOOKING_ALREADY_WAITING (with the booking to open) rather than another
    // refusal, e.g. "technician busy" when rebooking the same technician. Checked again under the lock below.
    await this.assertNoWaitingBooking(this.prisma, userId, false);
    await assertNotSuspended(this.prisma, userId);
    await this.assertModeEnabled(dto.mode);
    const start = new Date(dto.scheduledStart);
    if (!Number.isFinite(start.getTime()) || start <= new Date())
      throw new BadRequestException('Thời gian đặt lịch phải ở tương lai');
    await this.assertLeadTime(start);
    if (dto.mode !== 'HOME' && dto.addressId) throw new BadRequestException('Chỉ gửi addressId khi đặt tại nhà');
    // Store codes, as technician profiles do: a name ("Ha Noi") or an unknown value would match no technician and the
    // customer would wait for nothing. 400 INVALID_CITY / INVALID_DISTRICT instead.
    const place = await resolveLocationCodes(this.prisma, dto.city, dto.district);
    dto = { ...dto, city: place.city ?? dto.city, district: place.district ?? undefined };
    // Online sessions cannot be paid in cash: they are paid online once a technician takes them.
    if (dto.mode === 'ONLINE') dto = { ...dto, paymentMethod: 'ONLINE' };
    const now = new Date();
    const deadline = confirmationDeadline(
      now,
      start,
      dto.applicationDeadlineAt ? new Date(dto.applicationDeadlineAt) : null,
      (await this.bookingRules()).confirmationWaitMinutes,
    );
    if (!Number.isFinite(deadline.getTime()) || deadline <= now || deadline >= start)
      throw new BadRequestException('Hạn nhận đơn phải nằm giữa hiện tại và giờ đặt lịch');
    const catalogIds = [...new Set(dto.items.map((item) => item.catalogServiceId))];
    if (catalogIds.length !== dto.items.length) throw new BadRequestException('Không được trùng dịch vụ');
    const catalog = await this.prisma.serviceCatalogItem.findMany({
      where: { id: { in: catalogIds }, isActive: true, category: { isActive: true } },
      include: { category: { select: { name: true } }, priceOptions: { where: { isActive: true } } },
    });
    if (catalog.length !== catalogIds.length)
      throw new BadRequestException('Dịch vụ không hợp lệ hoặc đã ngừng hoạt động');
    if (catalog.some((item) => !item.modes.includes(dto.mode)))
      throw new BadRequestException('Dịch vụ không hỗ trợ hình thức đặt này');
    let addressSnapshot: Prisma.InputJsonValue | undefined;
    if (dto.mode === 'HOME') {
      if (!dto.addressId) throw new BadRequestException('Đặt tại nhà cần chọn địa chỉ');
      const address = await this.prisma.address.findFirst({
        where: { id: dto.addressId, userId, deletedAt: null },
        select: { id: true, address: true, phone: true, note: true, latitude: true, longitude: true, label: true },
      });
      if (!address) throw new BadRequestException('Địa chỉ không hợp lệ');
      addressSnapshot = {
        id: address.id,
        addressText: address.address,
        address: address.address,
        latitude: Number(address.latitude),
        longitude: Number(address.longitude),
        label: address.label,
        phone: address.phone,
        note: address.note,
        city: dto.city,
        district: dto.district ?? null,
      };
    }
    const ordered = dto.items.map((item) => {
      const service = catalog.find((value) => value.id === item.catalogServiceId)!;
      const option = service.priceOptions.find((value) => value.id === item.priceOptionId);
      if (!option) throw new BadRequestException('Gói giá không hợp lệ hoặc đã ngừng hoạt động');
      return { service, option };
    });
    // Booked with a chosen technician: that technician's own prices (what /quote showed), locked for whoever takes
    // the booking. Without one, the catalog price.
    const chosen = requestedTechnicianId && requestedPrices
      ? await this.technicianPrices(requestedTechnicianId, dto.mode, requestedPrices)
      : null;
    const lines = ordered.map((item, index) => ({ ...item, chosen: chosen?.[index] ?? null, price: Number(chosen?.[index]?.price ?? item.option.price) }));
    const durationMinutes = ordered.reduce((sum, item) => sum + item.option.durationMinutes, 0);
    const serviceFee = dto.mode === 'HOME' ? (await this.bookingRules()).homeServiceFee : 0;
    const subtotal = lines.reduce((sum, item) => sum + item.price, 0);
    const financials = this.feePolicy.calculate({
      assignmentMode: 'OPEN_MARKETPLACE',
      grossServiceAmount: subtotal,
      paymentMethod: dto.paymentMethod,
      calculatedAt: new Date(),
    });
    // Same voucher rules as a direct booking; the travel fee added at selection does not change the discount.
    const promotion = dto.promotionCode ? await this.validPromotion(userId, dto.promotionCode, subtotal, this.prisma as any) : null;
    const discountAmount = promotion ? this.discount(promotion, subtotal, serviceFee) : 0;
    const customerPayableAmount = Prisma.Decimal.max(0, new Prisma.Decimal(subtotal).plus(serviceFee).minus(discountAmount));
    const scheduledEnd = new Date(start.getTime() + durationMinutes * 60_000);
    // A chosen technician who cannot take this booking would never be notified and the customer
    // would wait for nothing; refuse it now so the app can ask for another technician.
    if (requestedTechnicianId)
      await this.assertOpenEligibility(
        this.prisma,
        {
          customerId: userId,
          assignmentMode: 'OPEN_MARKETPLACE',
          status: 'OPEN',
          mode: dto.mode,
          addressSnapshot: addressSnapshot ?? { city: dto.city, district: dto.district ?? null },
          scheduledStart: start,
          scheduledEnd,
          items: ordered.map(({ service }) => ({ catalogService: service })),
        },
        requestedTechnicianId,
      );
    const created = await this.prisma.$transaction(async (tx) => {
      await this.assertNoWaitingBooking(tx, userId);
      if (promotion) await this.reservePromotion(tx, promotion.id, promotion.usageLimit);
      return tx.booking.create({
      data: {
        customerId: userId,
        requestedTechnicianId,
        promotionId: promotion?.id ?? null,
        assignmentMode: 'OPEN_MARKETPLACE',
        status: 'OPEN',
        mode: dto.mode,
        addressId: dto.mode === 'HOME' ? dto.addressId : null,
        addressSnapshot: addressSnapshot ?? { city: dto.city, district: dto.district ?? null },
        applicationDeadlineAt: deadline,
        scheduledStart: start,
        scheduledEnd,
        subtotal,
        serviceFee,
        discountAmount,
        totalAmount: customerPayableAmount,
        grossServiceAmount: financials.grossServiceAmount,
        platformFee: financials.platformFee,
        technicianEarning: financials.technicianEarning.plus(serviceFee),
        customerPayableAmount,
        feePolicyVersion: financials.feePolicyVersion,
        note: dto.note,
        items: {
          create: lines.map(({ service, option, chosen, price }) => ({
            catalogServiceId: service.id,
            catalogPriceOptionId: option.id,
            serviceId: chosen?.id ?? null,
            priceOptionId: chosen?.priceOptionId ?? null,
            priceOptionCode: chosen?.priceOptionCode ?? null,
            categoryId: service.categoryId,
            categoryName: service.category.name,
            serviceName: service.name,
            durationMinutes: option.durationMinutes,
            unitPrice: price,
          })),
        },
        payment: { create: { method: dto.paymentMethod, status: 'UNPAID', amount: customerPayableAmount } },
        ...(promotion ? { promotionUsage: { create: { promotionId: promotion.id, userId } } } : {}),
      },
      include: { items: { include: { catalogService: true } }, payment: true },
      });
    });
    // Complete the in-app notification fan-out before returning.  Previously
    // this was fire-and-forget, so clients could immediately query jobs or
    // notifications and observe only the first/none of the eligible KTVs
    // while the asynchronous fan-out was still running.
    await this.notifyEligibleTechniciansForOpenBooking(created);
    return {
      ...this.openBookingResponse(created, null, false),
      expiresInSeconds: Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 1000)),
    };
  }

  async applyToOpenJob(userId: string, bookingId: string) {
    const profile = await this.requireActiveTechnician(userId);
    await this.requireTechnicianPhone(userId);
    await assertNotSuspended(this.prisma, userId, true);
    const booking = await this.openJobForTechnician(bookingId, profile.id, true);
    const existing = await this.prisma.bookingTechnicianApplication.findUnique({
      where: { bookingId_technicianProfileId: { bookingId, technicianProfileId: profile.id } },
    });
    const requested = booking.requestedTechnicianId === profile.id;
    if (existing?.status === 'APPLIED')
      return requested ? this.acceptAsRequestedTechnician(userId, booking, existing.id) : { ...existing, idempotent: true };
    if (existing) throw new ConflictException('Trạng thái hiện tại không cho phép nhận đơn lại');
    // Selection charges the commission, so a technician who could not pay it must not be selectable. A prepaid online
    // booking takes the commission out of the payment instead, so no wallet balance is needed.
    const fee = isPrepaid(booking) ? 0 : await this.commissionFor(booking.grossServiceAmount, userId);
    if (fee > 0) {
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId_type: { userId, type: 'ADVERTISING_CREDIT' } },
        select: { balanceVnd: true },
      });
      if ((wallet?.balanceVnd ?? 0) < fee) throw new ConflictException('Số dư ví không đủ để nhận đơn');
    }
    try {
      const application = await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        // Touching the row takes its lock: a concurrent assignment either finishes first (then this
        // sees the booking is no longer OPEN) or waits for this application and marks it NOT_SELECTED.
        const claimed = await tx.booking.updateMany({
          where: {
            id: bookingId,
            assignmentMode: 'OPEN_MARKETPLACE',
            status: 'OPEN',
            technicianId: null,
            OR: [{ applicationDeadlineAt: null }, { applicationDeadlineAt: { gt: now } }],
          },
          data: { status: 'OPEN' },
        });
        if (!claimed.count) throw new ConflictException('Đơn không còn mở để nhận');
        return tx.bookingTechnicianApplication.create({
          data: { bookingId, technicianProfileId: profile.id, status: 'APPLIED', appliedAt: now },
        });
      });
      if (requested) return this.acceptAsRequestedTechnician(userId, booking, application.id);
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

  /** The technician the customer picked accepting is the confirmation; no customer selection is needed. */
  private async acceptAsRequestedTechnician(userId: string, booking: any, applicationId: string) {
    const result = await this.assignOpenBooking(booking.id, applicationId, booking.customerId);
    const technician = await this.prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
    void this.notifyStatus(
      booking.customerId,
      booking.id,
      'REQUESTED_TECHNICIAN_ACCEPTED',
      'KTV đã nhận đơn',
      `${technician?.displayName || 'KTV bạn chọn'} đã nhận đơn của bạn.`,
    );
    void this.afterOpenBookingAssigned(booking.id, result);
    return { id: applicationId, bookingId: booking.id, status: 'SELECTED', bookingStatus: result.booking.status };
  }

  async declineOpenJob(userId: string, bookingId: string) {
    const profile = await this.requireActiveTechnician(userId);
    const booking = await this.openJobForTechnician(bookingId, profile.id, true);
    const existing = await this.prisma.bookingTechnicianApplication.findUnique({
      where: { bookingId_technicianProfileId: { bookingId, technicianProfileId: profile.id } },
    });
    if (existing) return existing;
    const declined = await this.prisma.bookingTechnicianApplication.create({
      data: { bookingId, technicianProfileId: profile.id, status: 'DECLINED', declinedAt: new Date() },
    });
    // The booking stays open for other applicants; the customer only needs to know their pick said no.
    if (booking.requestedTechnicianId === profile.id) {
      const technician = await this.prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
      const name = technician?.displayName || 'KTV bạn chọn';
      void this.notifyStatus(
        booking.customerId,
        bookingId,
        'REQUESTED_TECHNICIAN_DECLINED',
        'KTV đã từ chối',
        `${name} đã từ chối đơn. Đơn vẫn mở để KTV khác nhận.`,
      );
    }
    return declined;
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
    if (!updated.count) throw new ConflictException('Không thể rút nhận đơn ở trạng thái hiện tại');
    return this.prisma.bookingTechnicianApplication.findUniqueOrThrow({
      where: { bookingId_technicianProfileId: { bookingId, technicianProfileId: profile.id } },
    });
  }

  async selectTechnician(customerId: string, bookingId: string, applicationId: string) {
    const result = await this.assignOpenBooking(bookingId, applicationId, customerId).catch((error) => {
      // The technician's wallet dropped since they applied; that is their business, not the customer's.
      if (error instanceof ConflictException && error.message === 'Số dư ví không đủ để nhận đơn')
        throw new ConflictException('KTV này hiện không nhận được đơn, vui lòng chọn KTV khác');
      throw error;
    });
    void this.notifyStatus(
      result.winnerUserId,
      bookingId,
      'TECHNICIAN_SELECTED',
      'Bạn đã được chọn',
      'Khách hàng đã chọn bạn cho đơn dịch vụ.',
    );
    void this.afterOpenBookingAssigned(bookingId, result);
    return this.openBookingResponse(result.booking, 'SELECTED', true);
  }

  /** Charges the commission and confirms an open booking for one applicant; the rest become NOT_SELECTED. */
  private async assignOpenBooking(bookingId: string, applicationId: string, customerId: string) {
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
          if (!claimed.count) throw new ConflictException('Đơn đã có KTV, đã hủy hoặc không còn mở');
          const application = await tx.bookingTechnicianApplication.findFirst({
            where: { id: applicationId, bookingId, status: 'APPLIED' },
            include: { technicianProfile: { include: { user: { select: { id: true } } } } },
          });
          if (!application) throw new BadRequestException('Nhận đơn không hợp lệ');
          const booking = await tx.booking.findUniqueOrThrow({
            where: { id: bookingId },
            include: { items: { include: { catalogService: true } }, payment: { select: { method: true } } },
          });
          await this.assertOpenEligibility(tx, booking, application.technicianProfileId);
          const prepaid = isPrepaid(booking);
          const paymentDeadlineAt = prepaid
            ? new Date(now.getTime() + (await this.bookingRules()).onlinePaymentWaitMinutes * 60_000)
            : null;
          // The travel fee depends on who comes, so it is only known now; the commission stays on the services.
          const travelDistanceKm = booking.mode === 'HOME' ? kmBetween(booking.addressSnapshot as any, application.technicianProfile) : null;
          const travelFee = travelFeeFor(booking.mode, travelDistanceKm, await this.bookingRules());
          const feeChange = travelFee - Number(booking.travelFee ?? 0);
          await tx.bookingTechnicianApplication.update({
            where: { id: application.id },
            data: { status: 'SELECTED', selectedAt: now },
          });
          await tx.bookingTechnicianApplication.updateMany({
            where: { bookingId, id: { not: application.id }, status: 'APPLIED' },
            data: { status: 'NOT_SELECTED' },
          });
          let assigned = await tx.booking.update({
            where: { id: bookingId },
            data: {
              technicianId: application.technicianProfileId,
              status: 'CONFIRMED',
              travelFee,
              travelDistanceKm,
              paymentDeadlineAt,
              ...(feeChange !== 0 && {
                totalAmount: { increment: feeChange },
                customerPayableAmount: { increment: feeChange },
                technicianEarning: { increment: feeChange },
                payment: { update: { amount: { increment: feeChange } } },
              }),
            },
            include: { items: { include: { catalogService: true } }, payment: true },
          });
          // A voucher covered the whole price: nothing to pay (a payment gateway refuses 0đ), so it counts as paid
          // now and the technician can start right away. The technician's share is still recorded on completion.
          if (prepaid && Number(assigned.payment?.amount ?? 0) <= 0)
            assigned = await tx.booking.update({
              where: { id: bookingId },
              data: { paymentDeadlineAt: null, payment: { update: { status: 'PAID', paidAt: now, provider: 'VOUCHER' } } },
              include: { items: { include: { catalogService: true } }, payment: true },
            });
          // Charged after the assignment: the charge only accepts a booking that belongs to the
          // technician. Same transaction, so an insufficient wallet still rolls everything back.
          // A prepaid online booking is not charged: the commission comes out of the customer's payment.
          if (booking.mode === 'ONSITE') await this.snapshotFacility(tx, bookingId);
          if (!prepaid) await this.chargeTechnicianCommission(application.technicianProfile.user.id, bookingId, tx);
          else await this.recordPrepaidCommission(application.technicianProfile.user.id, bookingId, tx);
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
        throw new ConflictException('Đơn đang được chọn KTV, vui lòng thử lại');
      throw error;
    }
    return result;
  }

  /** Everyone the booking reached (announced or applied) learns it is taken, except the winner and those who said no. */
  private async afterOpenBookingAssigned(
    bookingId: string,
    result: { booking: any; winnerUserId: string; loserUserIds: string[] },
  ) {
    this.realtime?.broadcastAvailabilityChanged(result.booking.technicianId);
    // Prepaid online booking: the customer now has a few minutes to pay; the technician waits for it.
    if (result.booking.paymentDeadlineAt) {
      const until = new Date(result.booking.paymentDeadlineAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
      void this.notifyStatus(result.booking.customerId, bookingId, 'BOOKING_PAYMENT_REQUIRED', 'Đã có KTV nhận, vui lòng thanh toán',
        `Thanh toán trước ${until} để xác nhận buổi tư vấn. Quá thời gian đơn sẽ tự hủy.`);
      void this.notifyStatus(result.winnerUserId, bookingId, 'BOOKING_AWAITING_PAYMENT', 'Đang chờ khách thanh toán',
        `Khách có đến ${until} để thanh toán. Bạn sẽ được báo khi khách trả xong.`);
    }
    const applicants = new Set(result.loserUserIds);
    let recipients = new Set(applicants);
    try {
      const [optedOut, announced] = await Promise.all([
        this.prisma.bookingTechnicianApplication.findMany({
          where: { bookingId, status: { in: ['DECLINED', 'WITHDRAWN'] } },
          include: { technicianProfile: { select: { userId: true } } },
        }),
        this.prisma.notification.findMany({
          where: { actionUrl: `matxa://bookings/${bookingId}`, type: { in: ['OPEN_BOOKING_AVAILABLE', 'OPEN_BOOKING_REQUESTED'] } },
          select: { userId: true },
        }),
      ]);
      const skip = new Set(optedOut.map((item) => item.technicianProfile.userId));
      recipients = new Set([...applicants, ...announced.map((item) => item.userId)].filter((userId) => !skip.has(userId)));
    } catch (error) {
      this.logger.warn(
        `Khong tai duoc KTV da nhan thong bao don ${bookingId}: ${error instanceof Error ? error.message : 'khong ro ly do'}`,
      );
    }
    recipients.delete(result.winnerUserId);
    for (const userId of recipients)
      void this.notifyStatus(
        userId,
        bookingId,
        'TECHNICIAN_NOT_SELECTED',
        'Đơn đã có KTV nhận',
        applicants.has(userId) ? 'Khách đã chọn KTV khác cho đơn bạn ứng tuyển.' : 'Đơn này đã có KTV khác nhận.',
      );
    await this.releaseOtherOpenRequests(result.booking.technicianId, result.winnerUserId, bookingId);
  }

  /**
   * A technician takes one booking at a time, so once they get one their other open requests are
   * released: applications are withdrawn and bookings that asked for them are declined on their
   * behalf, so no customer keeps waiting for someone who can no longer come.
   */
  private async releaseOtherOpenRequests(technicianProfileId: string, technicianUserId: string, takenBookingId: string) {
    try {
      const now = new Date();
      await this.prisma.bookingTechnicianApplication.updateMany({
        where: {
          technicianProfileId, status: 'APPLIED', bookingId: { not: takenBookingId },
          booking: { assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN' },
        },
        data: { status: 'WITHDRAWN', withdrawnAt: now },
      });
      const waiting = await this.prisma.booking.findMany({
        where: {
          id: { not: takenBookingId }, assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN',
          requestedTechnicianId: technicianProfileId, applications: { none: { technicianProfileId } },
        },
        select: { id: true, customerId: true },
      });
      if (!waiting.length) return;
      await this.prisma.bookingTechnicianApplication.createMany({
        data: waiting.map((item) => ({ bookingId: item.id, technicianProfileId, status: 'DECLINED' as const, declinedAt: now })),
        skipDuplicates: true,
      });
      const technician = await this.prisma.user.findUnique({ where: { id: technicianUserId }, select: { displayName: true } });
      const name = technician?.displayName || 'KTV bạn chọn';
      for (const item of waiting)
        void this.notifyStatus(
          item.customerId,
          item.id,
          'REQUESTED_TECHNICIAN_DECLINED',
          'KTV đã từ chối',
          `${name} đã nhận đơn khác nên không thể nhận đơn này. Đơn vẫn mở để KTV khác nhận.`,
        );
    } catch (error) {
      this.logger.warn(
        `Khong giai phong duoc don mo khac cua KTV ${technicianProfileId}: ${error instanceof Error ? error.message : 'khong ro ly do'}`,
      );
    }
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
        applications: {
          include: { technicianProfile: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
          orderBy: { createdAt: 'asc' },
        },
        review: true,
        complaints: { select: { id: true, status: true, reasonCode: true, createdAt: true, customerId: true, reporterRole: true, conversation: { select: { id: true } } } },
      },
      orderBy: { scheduledStart: 'desc' },
    });
    const rules = await this.bookingRules();
    if (!query) {
      const bookings = await this.withRefunds(await listQuery, userId);
      return bookings.map((booking) => this.historyResponse(this.withHistoricalAddress(booking), userId, rules));
    }
    const [listed, total] = await Promise.all([listQuery, this.prisma.booking.count({ where })]);
    const bookings = await this.withRefunds(listed, userId);
    const items = bookings.map((booking) => this.historyResponse(this.withHistoricalAddress(booking), userId, rules));
    return query ? { items, total, page: options.page, limit: options.limit } : items;
  }

  async detail(userId: string, id: string, internal = false, allowMarketplaceTechnician = false) {
    const load = () => this.prisma.booking.findUnique({
      where: { id },
      include: {
        items: true,
        payment: true,
        address: true,
        promotion: true,
        review: true,
        complaints: { select: { id: true, status: true, reasonCode: true, createdAt: true, customerId: true, reporterRole: true, conversation: { select: { id: true } } } },
        customer: {
          select: { id: true, displayName: true, avatarUrl: true, gender: true, nationality: true, role: true },
        },
        technician: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
        applications: {
          include: { technicianProfile: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    let booking = await load();
    if (!booking) throw new NotFoundException('Lịch đặt không tồn tại');
    const actor = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const marketplaceNotification = allowMarketplaceTechnician && actor?.role === 'TECHNICIAN'
      ? await this.prisma.notification.findFirst({
          where: {
            userId,
            actionUrl: `matxa://bookings/${id}`,
            type: { in: ['OPEN_BOOKING_AVAILABLE', 'OPEN_BOOKING_REQUESTED', 'BOOKING_EXPIRED', 'BOOKING_CANCELLED', 'BOOKING_FALLBACK_OPEN'] },
          },
          select: { id: true },
        })
      : null;
    const marketplaceTechnician =
      allowMarketplaceTechnician && actor?.role === 'TECHNICIAN' && booking.assignmentMode === 'OPEN_MARKETPLACE';
    // Requested or applied (any application status): the job stays visible after it leaves OPEN.
    const involvedInMarketplaceJob =
      marketplaceTechnician &&
      (booking.applications.some((application) => application.technicianProfile.user.id === userId) ||
        (booking.requestedTechnicianId !== null &&
          (await this.prisma.technicianProfile.findUnique({ where: { userId }, select: { id: true } }))?.id ===
            booking.requestedTechnicianId));
    // An OPEN job is listed to every technician eligible for it now (listTechnicianJobs), including one who became
    // eligible after it was announced (e.g. finished or cancelled another job), so any technician may open it;
    // technicianJobDetail then shows Apply or UNAVAILABLE with the reason. Past states need an announcement or
    // involvement, as before.
    const canViewMarketplaceJob =
      marketplaceTechnician &&
      (booking.status === 'OPEN' ||
        (['EXPIRED', 'CANCELLED', 'CONFIRMED', 'COMPLETED'].includes(booking.status) && Boolean(marketplaceNotification)) ||
        involvedInMarketplaceJob);
    if (booking.customerId !== userId && booking.technician?.userId !== userId && actor?.role !== 'ADMIN' && !canViewMarketplaceJob)
      throw new ForbiddenException('Bạn không có quyền xem lịch đặt');
    // Opening a booking still waiting on PayOS asks PayOS directly, in case its webhook got lost.
    if (!internal && booking.payment?.status === 'PENDING' && booking.payment.provider === 'PAYOS' && (await this.syncPayosPayment(id)) === 'PAID')
      booking = (await load()) ?? booking;
    const historical = this.withHistoricalAddress(booking);
    if (internal) return historical;
    const [withRefund] = await this.withRefunds([historical], userId);
    return this.historyResponse(withRefund, userId, await this.bookingRules());
  }

  async listTechnicianJobs(userId: string, query: TechnicianJobQueryDto) {
    const profile = await this.requireActiveTechnician(userId);
    const commissionPercent = await this.commissionRate(userId);
    const travelRules = await this.bookingRules();
    const now = new Date();
    // Expired jobs stay in the history of technicians they were announced to, not everyone's.
    const announcements = await this.prisma.notification.findMany({
      where: { userId, type: { in: ['OPEN_BOOKING_AVAILABLE', 'OPEN_BOOKING_REQUESTED'] } },
      select: { actionUrl: true },
    });
    const announcedIds = announcements
      .map((item) => item.actionUrl?.replace('matxa://bookings/', ''))
      .filter((id): id is string => Boolean(id));
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
        { status: 'EXPIRED', id: { in: announcedIds } },
        { applications: { some: { technicianProfileId: profile.id } } },
        // The technician the customer picked keeps the job even if it is cancelled before they apply.
        { requestedTechnicianId: profile.id },
      ],
      ...(query.serviceId || query.serviceIds?.length
        ? { items: { some: { catalogServiceId: { in: [query.serviceId, ...(query.serviceIds ?? [])].filter(Boolean) as string[] } } } }
        : {}),
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
          complaints: { select: { id: true, status: true, reasonCode: true, createdAt: true, customerId: true, reporterRole: true, conversation: { select: { id: true } } } },
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
          ? this.openBookingResponse(booking, app?.status ?? null, Boolean(app?.status === 'SELECTED'), true, profile.id, profile, commissionPercent, travelRules)
          : this.technicianJobResponse(this.withHistoricalAddress(booking), userId, commissionPercent),
      );
    }
    return { items: visible, total, page: query.page, limit: query.limit };
  }

  async technicianJobDetail(userId: string, id: string) {
    const profile = await this.requireActiveTechnician(userId);
    const commissionPercent = await this.commissionRate(userId);
    const travelRules = await this.bookingRules();
    let booking = await this.detail(userId, id, true, true);
    // The technician waiting on the customer's payment: ask PayOS too, in case its webhook got lost.
    if (booking.technician?.userId === userId && booking.payment?.status === 'PENDING' && booking.payment.provider === 'PAYOS'
      && (await this.syncPayosPayment(id)) === 'PAID')
      booking = await this.detail(userId, id, true, true);
    if (booking.assignmentMode === 'OPEN_MARKETPLACE') {
      if (booking.status === 'OPEN' && booking.applicationDeadlineAt && booking.applicationDeadlineAt <= new Date()) {
        await this.expireOpenBookingIfDue(id);
        const expired = await this.detail(userId, id, true);
        const application = await this.prisma.bookingTechnicianApplication.findUnique({
          where: { bookingId_technicianProfileId: { bookingId: id, technicianProfileId: profile.id } },
        });
        return this.openBookingResponse(expired, application?.status ?? null, false, true, profile.id, profile, commissionPercent, travelRules);
      }
      const application = await this.prisma.bookingTechnicianApplication.findUnique({
        where: { bookingId_technicianProfileId: { bookingId: id, technicianProfileId: profile.id } },
      });
      if (booking.status === 'EXPIRED' && !application)
        return this.openBookingResponse(booking, 'EXPIRED', false, true, profile.id, profile, commissionPercent, travelRules);
      // detail() loads items without catalogService; reload them so eligibility sees catalog data.
      if (booking.status === 'OPEN' && !application) {
        const unavailableReason = await this.openJobForTechnician(id, profile.id, true).then(
          () => null,
          // An open job they were told about but can no longer take (busy, out of range…): show it, don't error.
          (error) => (error instanceof ConflictException || error instanceof ForbiddenException ? error.message : Promise.reject(error)),
        );
        if (unavailableReason)
          return {
            ...this.openBookingResponse(booking, null, false, true, profile.id, profile, commissionPercent, travelRules),
            displayStatus: 'UNAVAILABLE',
            unavailableReason,
            canApply: false,
            canDecline: false,
          };
      }
      // A cancelled or already-taken job reached detail() through an involvement or notification check; just show it.
      else if (!application && booking.requestedTechnicianId !== profile.id && !['CANCELLED', 'CONFIRMED', 'COMPLETED'].includes(booking.status))
        throw new ForbiddenException('Đơn không thuộc kỹ thuật viên này');
      return this.openBookingResponse(booking, application?.status ?? null, application?.status === 'SELECTED', true, profile.id, profile, commissionPercent, travelRules);
    }
    if (booking.technician?.userId !== userId) throw new ForbiddenException('Đơn không thuộc kỹ thuật viên này');
    return this.technicianJobResponse(booking, userId, commissionPercent);
  }

  async technicianJobContact(userId: string, id: string) {
    await this.requireActiveTechnician(userId);
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      select: {
        customerId: true,
        status: true,
        mode: true,
        paymentDeadlineAt: true,
        payment: { select: { method: true, status: true } },
        assignmentMode: true,
        addressSnapshot: true,
        technician: { select: { id: true, userId: true } },
        customer: { select: { displayName: true } },
      },
    });
    if (!booking || booking.technician?.userId !== userId) throw new NotFoundException('Đơn không tồn tại');
    if (!['CONFIRMED', 'COMPLETED'].includes(booking.status))
      throw new ForbiddenException('Chỉ hiện số liên hệ sau khi đã nhận đơn');
    // Not before the customer paid: otherwise the two could agree to skip the payment.
    if (isAwaitingPayment(booking))
      throw new ForbiddenException({ statusCode: 403, code: 'PAYMENT_REQUIRED', message: 'Chỉ hiện liên hệ sau khi khách thanh toán' });
    if (booking.assignmentMode === 'OPEN_MARKETPLACE') {
      const selected = await this.prisma.bookingTechnicianApplication.findFirst({
        where: { bookingId: id, technicianProfileId: booking.technician!.id, status: 'SELECTED' },
        select: { id: true },
      });
      if (!selected) throw new ForbiddenException('KTV chưa được chọn cho đơn này');
    }
    // The number entered with the booking's address comes first (the customer may book for someone else); otherwise
    // the account's verified phone.
    const addressPhone = (booking.addressSnapshot as { phone?: unknown } | null)?.phone;
    if (typeof addressPhone === 'string' && addressPhone)
      return { bookingId: id, displayName: booking.customer.displayName, phoneNumber: addressPhone, source: 'ADDRESS' as const };
    const phone = await this.prisma.userIdentity.findFirst({
      where: { userId: booking.customerId, provider: 'PHONE', phoneNumber: { not: null } },
      select: { phoneNumber: true },
    });
    if (!phone?.phoneNumber) throw new NotFoundException('Khách chưa có số điện thoại xác thực');
    return { bookingId: id, displayName: booking.customer.displayName, phoneNumber: phone.phoneNumber, source: 'ACCOUNT' as const };
  }

  async acceptTechnicianJob(userId: string, id: string) {
    await this.requireTechnicianPhone(userId);
    await assertNotSuspended(this.prisma, userId, true);
    return this.updateStatus(userId, id, { status: 'CONFIRMED' });
  }

  /** Admin booking rules; 0 means no limit. Defaults apply when settings are not wired (tests). */
  /** A "nơi phục vụ" the admin switched off cannot be booked (409 SERVICE_MODE_DISABLED). */
  private async assertModeEnabled(mode: string) {
    const enabled = (await this.bookingRules()).enabledServiceModes as string[] | undefined;
    if (mode && enabled && !enabled.includes(mode))
      throw new ConflictException({ code: 'SERVICE_MODE_DISABLED', message: 'Hình thức phục vụ này đang tạm dừng' });
  }

  private async bookingRules() {
    return (
      (await this.settings?.getBookingRules()) ?? {
        minAdvanceHours: 0,
        maxDispatchRadiusKm: 0,
        travelFeeThresholdKm: 10,
        travelFeeAmount: 0,
        confirmationWaitMinutes: Number(this.config.get('OPEN_BOOKING_APPLICATION_TTL_MINUTES', 10)),
        requireTechnicianPhone: false,
        homeServiceFee: Number(this.config.get('HOME_SERVICE_FEE', 100000)),
        dailyDiscountThreshold: 0,
        dailyDiscountFeePercent: 20,
        enabledServiceModes: ['HOME', 'ONLINE', 'ONSITE'] as Array<'HOME' | 'ONLINE' | 'ONSITE'>,
        cancelLimitCount: 0,
        cancelLimitWindowHours: 24,
        suspensionHours: [3, 24, 168],
        suspensionResetDays: 30,
        onlinePaymentWaitMinutes: 15,
        onlineCancelFeePercent: 20,
        payoutMinimumVnd: 100000,
        servicePriceMinVnd: 400000,
        servicePriceMaxVnd: 1000000,
      }
    );
  }

  /**
   * Customers and technicians may book (a technician can book another technician); admins and locked accounts cannot.
   * Booking oneself is refused separately (OWN_BOOKING).
   */
  private async assertCustomer(userId: string, chosenTechnicianId?: string | null) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true } });
    if (!(user?.status === 'ACTIVE' && ['CUSTOMER', 'TECHNICIAN'].includes(user.role)))
      throw new ForbiddenException({ statusCode: 403, code: 'CUSTOMER_ONLY', message: 'Tài khoản này không đặt lịch được' });
    if (
      chosenTechnicianId &&
      user.role === 'TECHNICIAN' &&
      (await this.prisma.technicianProfile.findFirst({ where: { id: chosenTechnicianId, userId }, select: { id: true } }))
    )
      throw new ForbiddenException({ statusCode: 403, code: 'OWN_BOOKING', message: 'Không thể đặt lịch cho chính mình' });
  }

  private async assertLeadTime(start: Date) {
    const { minAdvanceHours } = await this.bookingRules();
    if (minAdvanceHours > 0 && start.getTime() < Date.now() + minAdvanceHours * 3_600_000)
      throw new BadRequestException(`Vui lòng đặt lịch trước ít nhất ${minAdvanceHours} giờ`);
  }

  private async commissionRate(userId?: string, db: Prisma.TransactionClient | PrismaService = this.prisma) {
    return (await this.commissionPolicy(userId, db)).rate;
  }

  /**
   * The platform's cut for this technician right now: the usual rate, or the admin's lower daily rate once they
   * have completed `dailyDiscountThreshold` bookings today (Viet Nam time). Bookings charged earlier keep their fee.
   */
  private async commissionPolicy(userId?: string, db: Prisma.TransactionClient | PrismaService = this.prisma) {
    const rate = this.settings ? await this.settings.platformFeePercent() : Number(this.config.get('TECHNICIAN_COMMISSION_RATE_PERCENT', 25));
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new BadRequestException('Tỷ lệ chiết khấu KTV không hợp lệ');
    const usual = { rate, version: `COMMISSION_${rate}_V1` };
    const { dailyDiscountThreshold: threshold, dailyDiscountFeePercent: discounted } = await this.bookingRules();
    if (!userId || !(threshold > 0) || !(discounted >= 0 && discounted < rate)) return usual;
    const { today } = activityPeriods(new Date());
    const completedToday = await db.booking.count({
      where: { technician: { userId }, status: 'COMPLETED', scheduledStart: { gte: today.from, lt: today.to } },
    });
    return completedToday >= threshold ? { rate: discounted, version: `COMMISSION_${discounted}_DAILY${threshold}_V1` } : usual;
  }

  /** Commission the technician's wallet is charged when the booking is confirmed for them. */
  private async commissionFor(grossServiceAmount: unknown, userId?: string) {
    return roundVnd((Number(grossServiceAmount ?? 0) * (await this.commissionRate(userId))) / 100);
  }

  /**
   * An ONSITE booking keeps the facility (name, address, map point) as it is when the technician takes it, like a home
   * booking keeps the customer's address: later edits to the technician's profile no longer rewrite past bookings.
   */
  private async snapshotFacility(db: Prisma.TransactionClient, bookingId: string) {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: {
        mode: true,
        addressSnapshot: true,
        technician: { select: { facility: true, address: true, city: true, district: true, facilityLatitude: true, facilityLongitude: true } },
      },
    });
    if (booking?.mode !== 'ONSITE' || !booking.technician) return;
    const facility = facilityLocation(booking.technician);
    if (!facility) return;
    const snapshot = booking.addressSnapshot;
    const base = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? (snapshot as Prisma.JsonObject) : {};
    await db.booking.update({ where: { id: bookingId }, data: { addressSnapshot: { ...base, facility } } });
  }

  private async chargeTechnicianCommission(
    userId: string,
    bookingId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const booking = await db.booking.findFirst({
      where: { id: bookingId, technician: { userId } },
      select: { grossServiceAmount: true, serviceFee: true, travelFee: true },
    });
    if (!booking) throw new ForbiddenException('Đơn không thuộc KTV này');
    const { rate, version } = await this.commissionPolicy(userId, db);
    const fee = roundVnd((Number(booking.grossServiceAmount ?? 0) * rate) / 100);
    // The voucher discount is credited back only when the booking completes (creditBookingPromotion), not here.
    if (fee <= 0) return;
    const debit = async (tx: Prisma.TransactionClient) => {
      const wallet = await tx.wallet.upsert({ where: { userId_type: { userId, type: 'ADVERTISING_CREDIT' } }, create: { userId, type: 'ADVERTISING_CREDIT' }, update: {} });
      const existing = await tx.walletLedgerEntry.findUnique({ where: { referenceType_referenceId: { referenceType: 'BOOKING_COMMISSION', referenceId: bookingId } } });
      if (existing) return;
      const updated = await tx.wallet.updateMany({ where: { id: wallet.id, balanceVnd: { gte: fee } }, data: { balanceVnd: { decrement: fee } } });
      if (!updated.count) throw new ConflictException('Số dư ví không đủ để nhận đơn');
      const current = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id }, select: { balanceVnd: true } });
      await tx.walletLedgerEntry.create({ data: { walletId: wallet.id, type: 'COMMISSION_DEBIT', amountVnd: -fee, balanceBeforeVnd: current.balanceVnd + fee, balanceAfterVnd: current.balanceVnd, referenceType: 'BOOKING_COMMISSION', referenceId: bookingId } });
      await tx.booking.update({ where: { id: bookingId }, data: {
          platformFee: fee,
          // The home surcharge and travel fee are the technician's in full; only the services carry the commission.
          technicianEarning: Number(booking.grossServiceAmount ?? 0) - fee + Number(booking.serviceFee ?? 0) + Number(booking.travelFee ?? 0),
          feePolicyVersion: version,
        } });
    };
    if (db === this.prisma) await this.prisma.$transaction(debit);
    else await debit(db);
  }

  /**
   * A prepaid online booking: the commission is not taken from the wallet (the platform already holds the customer's
   * money) but it is fixed now, at the rate the technician has when taking it, so the job shows what they will receive
   * and the earning recorded on completion is the same amount.
   */
  private async recordPrepaidCommission(userId: string, bookingId: string, db: Prisma.TransactionClient) {
    const booking = await db.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { grossServiceAmount: true, serviceFee: true, travelFee: true },
    });
    const { rate, version } = await this.commissionPolicy(userId, db);
    const gross = Number(booking.grossServiceAmount ?? 0);
    const fee = roundVnd((gross * rate) / 100);
    await db.booking.update({
      where: { id: bookingId },
      data: {
        platformFee: fee,
        technicianEarning: gross - fee + Number(booking.serviceFee ?? 0) + Number(booking.travelFee ?? 0),
        feePolicyVersion: version,
      },
    });
  }

  async declineTechnicianJob(userId: string, id: string, dto: CancelBookingDto) {
    const booking = await this.detail(userId, id, true, true);
    if (booking.assignmentMode === 'OPEN_MARKETPLACE') return this.declineOpenJob(userId, id);
    if (booking.technician.userId !== userId) throw new ForbiddenException('Đơn không thuộc kỹ thuật viên này');
    if (booking.status !== 'PENDING') throw new BadRequestException('Chỉ có thể từ chối đơn mới');
    return this.cancel(userId, id, dto);
  }

  async completeTechnicianJob(userId: string, id: string) {
    const completed = await this.updateStatus(userId, id, { status: 'COMPLETED' });
    void this.announceOpenJobsToFreedTechnician(userId);
    return completed;
  }

  async cancel(userId: string, id: string, dto: CancelBookingDto) {
    let booking = await this.detail(userId, id, true);
    if (!['OPEN', 'PENDING', 'CONFIRMED'].includes(booking.status))
      throw new BadRequestException('Lịch đặt không thể hủy');
    // Paid but the webhook not in yet: record the payment first, so the cancel queues the refund it owes.
    if ((booking as { payment?: { status?: string } | null }).payment?.status === 'PENDING' && (await this.syncPayosPayment(id)) === 'PAID')
      booking = await this.detail(userId, id, true);
    if (dto.reasonCode === 'OTHER' && !dto.reasonText?.trim())
      throw new BadRequestException('Vui lòng nhập lý do khác');
    const actor = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    // The technician gets back the commission charged when they took the booking.
    const updated = await this.prisma.$transaction(async (tx) => {
      const cancelled = await this.transition(
        id,
        booking.status,
        {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: dto.reasonText ?? dto.reason,
          cancellationReasonCode: dto.reasonCode,
          cancellationReasonText: dto.reasonText,
          cancelledByUserId: userId,
          cancelledByRole: actor?.role,
          cancelPenalized: await isPenalizedCancel(tx, id, booking.status, actor?.role, dto.reasonCode),
        },
        tx,
      );
      await refundBookingCommission(tx, id);
      // The customer did not get the service, so the voucher can be used again.
      await releaseBookingPromotion(tx, id);
      // A paid online booking goes back to the customer (the admin sends it). A customer cancelling after a
      // technician took it keeps the cancellation fee out; a technician's or admin's cancel is refunded in full.
      const customerCancelled = booking.customerId === userId && actor?.role !== 'ADMIN';
      await createRefund(tx, id, {
        reason: customerCancelled ? 'Khách hủy đơn đã thanh toán' : actor?.role === 'ADMIN' ? 'Admin hủy đơn' : 'KTV hủy đơn',
        feePercent: customerCancelled && booking.status === 'CONFIRMED' ? (await this.bookingRules()).onlineCancelFeePercent : 0,
      });
      return cancelled;
    });
    if (booking.assignmentMode === 'OPEN_MARKETPLACE' && booking.status === 'OPEN') {
      const [applications, announced] = await Promise.all([
        this.prisma.bookingTechnicianApplication.findMany({
          where: { bookingId: id },
          include: { technicianProfile: { select: { userId: true } } },
        }),
        this.prisma.notification.findMany({
          where: { actionUrl: `matxa://bookings/${id}`, type: { in: ['OPEN_BOOKING_AVAILABLE', 'OPEN_BOOKING_REQUESTED'] } },
          select: { userId: true },
        }),
      ]);
      await this.prisma.bookingTechnicianApplication.updateMany({
        where: { bookingId: id, status: 'APPLIED' },
        data: { status: 'EXPIRED', expiredAt: new Date() },
      });
      // Everyone the job was announced to or who applied, except those who already said no.
      const usersWith = (statuses: string[]) =>
        new Set(applications.filter((a) => statuses.includes(a.status)).map((a) => a.technicianProfile.userId));
      const applied = usersWith(['APPLIED']);
      const optedOut = usersWith(['DECLINED', 'WITHDRAWN']);
      const recipients = new Set([...applied, ...announced.map((n) => n.userId)].filter((u) => !optedOut.has(u)));
      for (const recipient of recipients)
        void this.notifyStatus(
          recipient,
          id,
          'BOOKING_CANCELLED',
          'Đơn đã bị hủy',
          applied.has(recipient) ? 'Khách hàng đã hủy đơn mà bạn đang ứng tuyển.' : 'Khách hàng đã hủy đơn này.',
        );
    }
    const technicianUserId = booking.technician?.userId;
    // Their taken job is gone, so they can take another one now.
    if (booking.status === 'CONFIRMED') void this.announceOpenJobsToFreedTechnician(technicianUserId);
    const recipients =
      actor?.role === 'ADMIN'
        ? ([booking.customerId, technicianUserId].filter(Boolean) as string[])
        : ([booking.customerId === userId ? technicianUserId : booking.customerId].filter(Boolean) as string[]);
    for (const recipient of recipients)
      void this.notifyStatus(recipient, id, 'BOOKING_CANCELLED', 'Lịch hẹn đã hủy', 'Một lịch hẹn đã được hủy.');
    return { ...updated, cancelLimit: await this.applyCancelLimit(userId) };
  }

  /** The caller's standing against the cancel limit and any suspension, shown before cancelling. */
  async cancelLimit(userId: string) {
    return cancelLimitStatus(this.prisma, userId, await this.bookingRules());
  }

  /** After a cancel: suspends the canceller at their next level once they reach the limit. */
  async applyCancelLimit(userId: string) {
    const before = await activeSuspension(this.prisma, userId);
    const status = await applyCancelLimit(this.prisma, userId, await this.bookingRules());
    // Just suspended by this cancel: tell them why and until when.
    if (!before && status.suspension) {
      const title = 'Tài khoản của bạn đang tạm khóa';
      const body = `Bạn đã hủy quá nhiều đơn. Chưa thể đặt/nhận đơn mới đến ${status.suspension.endsAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.`;
      void Promise.resolve()
        .then(() => this.notifications.create(userId, 'ACCOUNT_SUSPENDED', title, body, 'matxa://notifications'))
        .then(() => this.notifications.sendPush(userId, title, body, { type: 'ACCOUNT_SUSPENDED' }))
        .catch(() => undefined);
    }
    return status;
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
      await releaseBookingPromotion(tx, bookingId);
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
      void this.notifications.notifyAdmins?.(
        'ADMIN_BOOKING_EXPIRED',
        'Đơn hết hạn chưa có KTV',
        `Đơn ${bookingId.slice(0, 8)} hết hạn ứng tuyển (${result.technicianUserIds.length} KTV đã ứng tuyển). Có thể cần liên hệ khách.`,
        'admin://orders',
      );
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
          requestedTechnicianId: booking.technicianId,
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
      throw new ForbiddenException('Chỉ kỹ thuật viên mới có thể cập nhật trạng thái');
    const allowed =
      (booking.status === 'PENDING' && dto.status === 'CONFIRMED') ||
      (booking.status === 'CONFIRMED' && dto.status === 'COMPLETED');
    if (!allowed) throw new BadRequestException('Chuyển trạng thái không hợp lệ');
    if (dto.status === 'COMPLETED' && booking.scheduledEnd > new Date()) {
      throw new BadRequestException('Chưa đến giờ kết thúc dịch vụ');
    }
    if (dto.status === 'COMPLETED' && isAwaitingPayment(booking))
      throw new ConflictException({ statusCode: 409, code: 'PAYMENT_REQUIRED', message: 'Khách chưa thanh toán đơn này' });
    if (dto.status === 'CONFIRMED' && (await this.expireDirectBookingIfDue(id)))
      throw new ConflictException('BOOKING_EXPIRED');
    // Confirming charges the commission; both commit together or not at all.
    const updated =
      dto.status === 'CONFIRMED'
        ? await this.prisma.$transaction(async (tx) => {
            const confirmed = await this.transition(id, booking.status, { status: 'CONFIRMED' }, tx);
            if (booking.mode === 'ONSITE') await this.snapshotFacility(tx, id);
            await this.chargeTechnicianCommission(userId, id, tx);
            return confirmed;
          })
        : await this.prisma.$transaction(async (tx) => {
            const completed = await this.transition(id, booking.status, { status: dto.status }, tx);
            await this.settleCompleted(tx, id);
            return completed;
          });
    const title = dto.status === 'CONFIRMED' ? 'Đặt lịch thành công' : 'Dịch vụ đã hoàn thành';
    void this.notifyStatus(booking.customerId, id, `BOOKING_${dto.status}`, title, title);
    if (dto.status === 'CONFIRMED' && booking.technicianId)
      void this.releaseOtherOpenRequests(booking.technicianId, userId, id);
    return updated;
  }

  async review(userId: string, id: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, customerId: userId },
      include: { review: true },
    });
    if (!booking) throw new NotFoundException('Lịch đặt không tồn tại');
    if (booking.status !== 'COMPLETED') throw new BadRequestException('Chỉ đánh giá sau khi hoàn thành dịch vụ');
    if (booking.review) throw new BadRequestException('Lịch đặt đã được đánh giá');
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            if (!booking.technicianId) throw new BadRequestException('Đơn chưa có KTV');
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
        if (code === 'P2002') throw new BadRequestException('Lịch đặt đã được đánh giá');
        if (code !== 'P2034') throw error;
        if (attempt === 2) throw new ConflictException('Đánh giá đang được cập nhật, vui lòng thử lại');
      }
    }
  }

  /** The customer or the technician of a booking files a complaint about it; each side once per booking. */
  async createComplaint(userId: string, id: string, dto: CreateComplaintDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, OR: [{ customerId: userId }, { technician: { userId } }] },
      select: { id: true, status: true, customerId: true, complaints: { select: { reporterRole: true } } },
    });
    if (!booking) throw new NotFoundException('Lịch đặt không tồn tại');
    const reporterRole = booking.customerId === userId ? 'CUSTOMER' : 'TECHNICIAN';
    if (!COMPLAINABLE_STATUSES.includes(booking.status))
      throw new BadRequestException('Chỉ có thể khiếu nại đơn đã có KTV nhận, đã hoàn thành hoặc đã hủy');
    if (booking.complaints.some((complaint) => complaint.reporterRole === reporterRole))
      throw new ConflictException('Lịch đặt đã được tạo khiếu nại');
    if (!dto.detail.trim()) throw new BadRequestException('Vui lòng nhập chi tiết khiếu nại');
    const evidence = dto.evidenceStorageKeys ?? [];
    if (evidence.length && this.complaintStorage) await this.complaintStorage.validateKeys(id, userId, evidence);
    try {
      const complaint = await this.prisma.complaint.create({
        data: {
          bookingId: id,
          customerId: userId,
          reporterRole,
          reasonCode: dto.reasonCode,
          detail: dto.detail.trim(),
          contactEmail: dto.contactEmail.trim().toLowerCase(),
          evidence: evidence.length
            ? { create: evidence.map((storageKey) => ({ storageKey, mediaType: 'IMAGE' })) }
            : undefined,
        },
        include: { evidence: true },
      });
      void this.notifications.notifyAdmins?.(
        'ADMIN_COMPLAINT_CREATED',
        reporterRole === 'TECHNICIAN' ? 'KTV gửi khiếu nại' : 'Khiếu nại mới',
        `Đơn ${id.slice(0, 8)}: ${dto.detail.trim().slice(0, 120)}`,
        'admin://complaints',
      );
      // The complaint opens its own support chat; the app jumps straight into it.
      const conversationId = await ensureComplaintConversation(this.prisma, complaint);
      return { ...complaint, conversationId };
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') throw new ConflictException('Lịch đặt đã được tạo khiếu nại');
      throw error;
    }
  }

  async assertComplaintUploadAllowed(userId: string, id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      select: { customerId: true, status: true, technician: { select: { userId: true } } },
    });
    if (!booking || (booking.customerId !== userId && booking.technician?.userId !== userId))
      throw new ForbiddenException('Bạn không có quyền tạo minh chứng cho lịch đặt này');
    if (!COMPLAINABLE_STATUSES.includes(booking.status))
      throw new BadRequestException('Chỉ có thể gửi minh chứng cho đơn đã có KTV nhận, đã hoàn thành hoặc đã hủy');
  }

  listComplaints(status?: string) {
    return this.prisma.complaint.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        booking: {
          select: {
            id: true, status: true, totalAmount: true, scheduledStart: true,
            technician: { select: { user: { select: { displayName: true, avatarUrl: true } } } },
            customer: { select: { displayName: true, avatarUrl: true } },
          },
        },
        customer: { select: { id: true, displayName: true, avatarUrl: true } },
        evidence: true,
        conversation: { select: { id: true, lastMessageAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** The customer's complaint on one of their bookings, with what the support chat header shows. */
  async customerComplaint(customerId: string, bookingId: string) {
    const complaint = await this.prisma.complaint.findFirst({
      where: { bookingId, customerId },
      include: COMPLAINT_CONTEXT_INCLUDE,
    });
    if (!complaint) throw new NotFoundException('Đơn này chưa có khiếu nại');
    return this.complaintContext(complaint);
  }

  /** Same view for the admin; opening it also creates the chat of an older complaint. */
  async adminComplaint(complaintId: string) {
    const complaint = await this.prisma.complaint.findUnique({ where: { id: complaintId }, include: COMPLAINT_CONTEXT_INCLUDE });
    if (!complaint) throw new NotFoundException('Khiếu nại không tồn tại');
    return { ...(await this.complaintContext(complaint)), customer: complaint.customer };
  }

  private async complaintContext(complaint: any) {
    const booking = complaint.booking;
    const technician = booking.technician;
    return {
      id: complaint.id,
      reporterRole: complaint.reporterRole ?? 'CUSTOMER',
      status: complaint.status,
      statusLabel: COMPLAINT_STATUS_LABEL[complaint.status] ?? complaint.status,
      reasonCode: complaint.reasonCode,
      reasonLabel: COMPLAINT_REASON_LABEL[complaint.reasonCode] ?? complaint.reasonCode,
      detail: complaint.detail,
      contactEmail: complaint.contactEmail,
      createdAt: complaint.createdAt,
      evidenceCount: complaint.evidence?.length ?? 0,
      conversationId: await ensureComplaintConversation(this.prisma, complaint),
      booking: {
        id: booking.id,
        code: booking.id.slice(0, 8).toUpperCase(),
        status: booking.status,
        mode: booking.mode,
        scheduledStart: booking.scheduledStart,
        scheduledEnd: booking.scheduledEnd,
        addressText: booking.mode === 'HOME' ? (booking.addressSnapshot?.address ?? booking.addressSnapshot?.addressText ?? null) : null,
        paymentMethod: booking.payment?.method ?? 'CASH',
        totalAmount: Number(booking.totalAmount),
        items: (booking.items ?? []).map((item: any) => ({
          name: item.serviceName,
          durationMinutes: item.durationMinutes,
          price: Number(item.unitPrice),
        })),
      },
      technician: technician
        ? {
            displayName: technician.user?.displayName ?? null,
            avatarUrl: technician.user?.avatarUrl ?? null,
            averageRating: Number(technician.averageRating ?? 0),
            reviewCount: technician.reviewCount ?? 0,
          }
        : null,
      // The other side for a technician's complaint.
      customer: booking.customer ? { displayName: booking.customer.displayName, avatarUrl: booking.customer.avatarUrl } : null,
    };
  }

  async updateComplaintStatus(adminId: string, id: string, status: 'IN_REVIEW' | 'RESOLVED' | 'REJECTED') {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      select: { id: true, bookingId: true, customerId: true },
    });
    if (!complaint) throw new NotFoundException('Khiếu nại không tồn tại');
    const updated = await this.prisma.complaint.update({ where: { id }, data: { status } });
    // The customer follows the case in its chat: post the change there and tell them.
    const conversationId = await ensureComplaintConversation(this.prisma, complaint);
    const now = new Date();
    await this.prisma.message.create({
      data: { conversationId, senderId: adminId, type: 'SYSTEM', text: complaintStatusEvent(status), bookingId: complaint.bookingId, createdAt: now },
    });
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } });
    const body = `Khiếu nại đơn #${complaint.bookingId.slice(0, 8).toUpperCase()}: ${COMPLAINT_STATUS_LABEL[status]}`;
    const actionUrl = `matxa://chat/${conversationId}`;
    await this.notifications.create(complaint.customerId, 'COMPLAINT_STATUS_CHANGED', 'Cập nhật khiếu nại', body, actionUrl);
    void this.notifications
      .sendPush(complaint.customerId, 'Cập nhật khiếu nại', body, {
        type: 'COMPLAINT_STATUS_CHANGED', complaintId: id, conversationId, bookingId: complaint.bookingId,
      })
      .catch(() => undefined);
    return updated;
  }

  private async transition(
    id: string,
    expectedStatus: 'OPEN' | 'EXPIRED' | 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED',
    data: {
      status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
      cancelledAt?: Date;
      cancellationReason?: string;
      cancellationReasonCode?: 'WAIT_TOO_LONG' | 'NO_LONGER_NEEDED' | 'SERVICE_ISSUE' | 'PAYMENT_REFUND_ISSUE' | 'OTHER';
      cancellationReasonText?: string;
      cancelledByUserId?: string;
      cancelledByRole?: 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN';
      cancelPenalized?: boolean;
    },
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    try {
      return await db.booking.update({ where: { id, status: expectedStatus }, data });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2025') {
        throw new ConflictException('Trạng thái lịch đặt đã thay đổi, vui lòng tải lại');
      }
      throw error;
    }
  }

  /** The customer calls the technician they booked, so taking a job needs a phone number on the account. */
  private async requireTechnicianPhone(userId: string) {
    if (!(await this.bookingRules()).requireTechnicianPhone) return;
    const phone = await this.prisma.userIdentity.findFirst({ where: { userId, phoneNumber: { not: null } }, select: { id: true } });
    if (!phone)
      throw new ConflictException({
        statusCode: 409,
        code: 'PHONE_REQUIRED',
        message: 'Vui lòng cập nhật số điện thoại trước khi nhận đơn',
      });
  }

  private async requireActiveTechnician(userId: string) {
    const profile = await this.prisma.technicianProfile.findFirst({
      where: { userId, isActive: true, isVerified: true, user: { status: 'ACTIVE' } },
      // Location for distances; facility fields for ONSITE job cards.
      select: { id: true, latitude: true, longitude: true, facility: true, address: true, facilityLatitude: true, facilityLongitude: true, city: true, district: true },
    });
    if (!profile) {
      // Hidden by an admin: say so, with the reason, instead of the generic refusal.
      const hidden = await this.prisma.technicianProfile.findFirst({ where: { userId, isActive: false }, select: { hiddenReason: true } });
      if (hidden)
        throw new ForbiddenException({ statusCode: 403, code: 'PROFILE_HIDDEN', message: 'Hồ sơ KTV đang tạm ẩn', reason: hidden.hiddenReason ?? null });
      throw new ForbiddenException('Tài khoản KTV chưa đủ điều kiện nhận đơn');
    }
    return profile;
  }

  private async openJobForTechnician(bookingId: string, technicianProfileId: string, requireEligible: boolean) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { items: { include: { catalogService: true } }, payment: { select: { method: true } } },
    });
    if (!booking || booking.assignmentMode !== 'OPEN_MARKETPLACE' || booking.status !== 'OPEN' || booking.technicianId)
      throw new ConflictException('Đơn không còn mở để nhận');
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
      throw new ConflictException('Đơn không còn mở');
    const profile = await db.technicianProfile.findFirst({
      where: {
        id: technicianProfileId,
        isActive: true,
        isVerified: true,
        user: { status: 'ACTIVE', role: 'TECHNICIAN', technicianApplication: { is: { status: 'APPROVED' } } },
      },
      select: { id: true, userId: true, city: true, district: true, serviceModes: true, latitude: true, longitude: true, facility: true, address: true },
    });
    if (!profile) throw new ForbiddenException('Tài khoản KTV chưa đủ điều kiện nhận đơn');
    // An account that booked as a customer (before becoming a technician) must not serve its own booking:
    // it is neither shown, announced, nor accepted/selected.
    if (booking.customerId && profile.userId === booking.customerId)
      throw new ForbiddenException({ statusCode: 403, code: 'OWN_BOOKING', message: 'Không thể nhận đơn do chính mình đặt' });
    const snapshot =
      booking.addressSnapshot && typeof booking.addressSnapshot === 'object' ? (booking.addressSnapshot as any) : null;
    // Online work can be done from anywhere: no radius or area filter.
    if (booking.mode !== 'ONLINE') {
      // Only home bookings carry coordinates; technicians without a location are not filtered out.
      const { maxDispatchRadiusKm } = await this.bookingRules();
      const distance = kmBetween(snapshot, profile);
      if (maxDispatchRadiusKm > 0 && distance !== null && distance > maxDispatchRadiusKm)
        throw new ForbiddenException('KTV ngoài bán kính phục vụ của đơn');
      if (snapshot?.city && profile.city && snapshot.city !== profile.city)
        throw new ForbiddenException('KTV không phù hợp khu vực của đơn');
      if (snapshot?.district && profile.district && snapshot.district !== profile.district)
        throw new ForbiddenException('KTV không phù hợp quận/huyện của đơn');
    }
    if (!profile.serviceModes.includes(booking.mode))
      throw new ForbiddenException('KTV không hỗ trợ hình thức dịch vụ này');
    // The customer comes to the technician's facility, so one without an address cannot take it.
    if (booking.mode === 'ONSITE' && !profile.facility?.trim() && !profile.address?.trim())
      throw new ConflictException({ statusCode: 409, code: 'FACILITY_REQUIRED', message: 'Vui lòng cập nhật địa chỉ cơ sở trước khi nhận đơn tại cơ sở' });
    const unfinished = await db.booking.findFirst({
      where: {
        technicianId: profile.id,
        status: 'CONFIRMED',
        id: { not: booking.id },
      },
      select: { id: true },
    });
    if (unfinished) throw new ConflictException('KTV phải hoàn thành đơn hiện tại trước khi nhận đơn mới');
    // A suspended technician is neither announced, nor can apply or be selected.
    if (await activeSuspension(db, profile.userId)) throw new ConflictException('KTV đang bị tạm khóa, chưa thể nhận đơn mới');
    // Nor while the account has its own booking (as a customer) waiting or not finished.
    const ownBooking = await db.booking.findFirst({
      where: { ...unfinishedAsCustomer(profile.userId), id: { not: booking.id } },
      select: { id: true },
    });
    if (ownBooking) throw new ConflictException('KTV đang có đơn đặt với tư cách khách chưa xong, chưa thể nhận đơn mới');
    const catalogItems = (booking.items ?? []).map((item: any) => item.catalogService).filter(Boolean);
    if (!catalogItems.length || catalogItems.length !== (booking.items ?? []).length)
      throw new BadRequestException('Dữ liệu dịch vụ của đơn mở không hợp lệ');
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
      if (!service) throw new ForbiddenException('KTV chưa có dịch vụ phù hợp với đơn này');
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
    if (!available) throw new ConflictException('KTV không rảnh trong khung giờ này');
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
    if (conflict) throw new ConflictException('KTV đã có lịch trùng thời gian');
  }

  private openBookingResponse(
    booking: any,
    applicationStatus: string | null,
    selected: boolean,
    includeTechnicianPricing = false,
    viewerTechnicianId?: string,
    viewerLocation?: { latitude?: unknown; longitude?: unknown },
    commissionPercent?: number,
    travelRules?: { travelFeeThresholdKm: number; travelFeeAmount: number },
  ) {
    // Also true for a technician who never applied (e.g. the requested one) once someone else got the job.
    const takenByAnother =
      applicationStatus === 'NOT_SELECTED' ||
      (Boolean(viewerTechnicianId) && Boolean(booking.technicianId) && booking.technicianId !== viewerTechnicianId &&
        ['CONFIRMED', 'COMPLETED'].includes(booking.status));
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
      requestedTechnicianId: booking.requestedTechnicianId ?? null,
      ...(viewerTechnicianId ? this.technicianRequestMetadata(booking, viewerTechnicianId) : {}),
      bookingStatus: booking.status,
      applicationStatus: effectiveApplicationStatus,
      isSelected: effectiveApplicationStatus === 'SELECTED',
      isApplicant: effectiveApplicationStatus === 'APPLIED',
      scheduledAt: booking.scheduledStart,
      scheduledStart: booking.scheduledStart,
      scheduledEnd: booking.scheduledEnd,
      mode: booking.mode,
      paymentMethod: booking.payment?.method ?? 'CASH',
      ...paymentFields(booking),
      durationMinutes: (booking.items ?? []).reduce((sum: number, item: any) => sum + item.durationMinutes, 0),
      subtotal: Number(booking.subtotal),
      serviceFee: Number(booking.serviceFee),
      travelFee: Number(booking.travelFee ?? 0),
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
      address: selected ? (booking.addressSnapshot ?? null) : null,
      // Full street address as text so the technician can judge the trip; coordinates (`address`) stay hidden until selected.
      addressText: booking.mode === 'HOME' ? (booking.addressSnapshot?.address ?? booking.addressSnapshot?.addressText ?? null) : null,
      addressPreview: booking.mode === 'HOME' ? addressPreview(booking.addressSnapshot) : null,
      // ONSITE: the facility the customer goes to. For a technician that is their own (open or theirs; null once
      // another took it); for the customer, the assigned technician's.
      facility:
        booking.mode === 'ONSITE'
          ? viewerTechnicianId
            ? !booking.technicianId
              ? facilityLocation(viewerLocation)
              : booking.technicianId === viewerTechnicianId
                ? (bookedFacility(booking) ?? facilityLocation(viewerLocation))
                : null
            : (bookedFacility(booking) ?? facilityLocation(booking.technician))
          : null,
      city: booking.addressSnapshot?.city ?? null,
      district: booking.addressSnapshot?.district ?? null,
      distanceKm: kmBetween(booking.addressSnapshot, viewerLocation),
      canApply,
      canDecline: canApply && booking.requestedTechnicianId === viewerTechnicianId,
      canWithdraw: booking.status === 'OPEN' && effectiveApplicationStatus === 'APPLIED',
      // Contact and completion wait for an online booking's payment.
      canContact: selected && ['CONFIRMED', 'COMPLETED'].includes(booking.status) && !isAwaitingPayment(booking),
      canCancel: selected && booking.status === 'CONFIRMED',
      canComplete: selected && booking.status === 'CONFIRMED' && new Date(booking.scheduledEnd) <= new Date() && !isAwaitingPayment(booking),
      customerSelectedAnotherTechnician: takenByAnother,
      ...(viewerTechnicianId && selected
        ? (() => {
            const ownComplaint = (booking.complaints ?? []).find((complaint: any) => complaint.reporterRole === 'TECHNICIAN') ?? null;
            return {
              ...this.complaintFields(ownComplaint),
              canComplain: !ownComplaint && COMPLAINABLE_STATUSES.includes(booking.status),
            };
          })()
        : {}),
      displayStatus: this.jobDisplayStatus(booking, effectiveApplicationStatus, selected, takenByAnother, viewerTechnicianId),
      applicationDeadlineAt: booking.applicationDeadlineAt ?? null,
      expiredAt: booking.expiredAt ?? null,
      ...(includeTechnicianPricing
        ? {
            pricing: this.technicianPricing(
              booking,
              selected ? undefined : commissionPercent,
              // Not theirs yet: the travel fee they would get from their own location.
              travelRules ? travelFeeFor(booking.mode, kmBetween(booking.addressSnapshot, viewerLocation), travelRules) : 0,
            ),
          }
        : {}),
    };
  }

  /** One label per technician card, matching the Figma states, so the app does not combine flags itself. */
  private jobDisplayStatus(
    booking: any,
    applicationStatus: string | null,
    selected: boolean,
    takenByAnother: boolean,
    viewerTechnicianId?: string,
  ) {
    if (booking.status === 'CANCELLED') return 'CANCELLED';
    if (selected && booking.status === 'COMPLETED') return 'COMPLETED';
    // Taken, but the online booking's customer has not paid yet.
    if (selected && isAwaitingPayment(booking)) return 'AWAITING_PAYMENT';
    if (selected && booking.status === 'CONFIRMED') return 'ACCEPTED';
    if (takenByAnother) return 'NOT_SELECTED';
    if (booking.status === 'EXPIRED' || applicationStatus === 'EXPIRED') return 'EXPIRED';
    if (applicationStatus === 'APPLIED') return 'APPLIED';
    if (applicationStatus === 'DECLINED' || applicationStatus === 'WITHDRAWN') return applicationStatus;
    return booking.requestedTechnicianId && booking.requestedTechnicianId === viewerTechnicianId ? 'REQUESTED' : 'NEW';
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
      travelFee: Number(booking.travelFee ?? 0),
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

  /** Adds the refund queued for the customer's cancelled paid online bookings (only those can have one). */
  private async withRefunds<T extends { id: string; customerId: string; status: string; mode: string; payment?: { method?: string | null; status?: string | null } | null }>(
    bookings: T[],
    userId: string,
  ): Promise<Array<T & { refund?: unknown }>> {
    const ids = bookings
      .filter((booking) => booking.customerId === userId && booking.status === 'CANCELLED' && isPrepaid(booking) && booking.payment?.status === 'PAID')
      .map((booking) => booking.id);
    if (!ids.length) return bookings;
    const refunds = await this.prisma.bookingRefund.findMany({ where: { bookingId: { in: ids } } });
    return bookings.map((booking) => ({ ...booking, refund: refunds.find((refund) => refund.bookingId === booking.id) ?? null }));
  }

  private historyResponse(booking: any, userId: string, travelRules?: { travelFeeThresholdKm: number; travelFeeAmount: number }) {
    const isCustomer = booking.customerId === userId;
    const canCancel = isCustomer && ['OPEN', 'PENDING', 'CONFIRMED'].includes(booking.status);
    const canReview = isCustomer && booking.status === 'COMPLETED' && !booking.review;
    const ownComplaint = (booking.complaints ?? []).find((complaint: any) => complaint.customerId === userId) ?? null;
    // Financial accounting belongs to KTV/admin responses, never customer history.
    const {
      grossServiceAmount,
      platformFee,
      technicianEarning,
      customerPayableAmount,
      feePolicyVersion,
      // Only the viewer's own complaint is returned, below.
      complaints: _complaints,
      ...customerSafeBooking
    } = booking;
    return {
      ...customerSafeBooking,
      technician: {
        technicianId: booking.technicianId,
        displayName: booking.technician?.user?.displayName ?? null,
        avatarUrl: booking.technician?.user?.avatarUrl ?? null,
      },
      // ONSITE: where the customer goes — the technician's facility, with coordinates for the map. null otherwise.
      facility: booking.mode === 'ONSITE' ? (bookedFacility(booking) ?? facilityLocation(booking.technician)) : null,
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
      travelFee: Number(booking.travelFee ?? 0),
      travelDistanceKm: booking.travelDistanceKm === null || booking.travelDistanceKm === undefined ? null : Number(booking.travelDistanceKm),
      discount: Number(booking.discountAmount),
      total: Number(booking.totalAmount),
      totalAmount: Number(booking.totalAmount),
      // The payer's bank account and the gateway references are the customer's own business (admins see them in the
      // refunds page); a technician calling this API gets the payment without them.
      payment: paymentView(booking.payment, isCustomer),
      paymentMethod: booking.payment?.method ?? null,
      ...paymentFields(booking),
      // What a cancelled paid booking gives back, as queued for the admin (not recomputed from today's fee).
      refund: isCustomer ? refundView(booking.refund) : null,
      canCancel,
      canReview,
      // Each side sees only its own complaint, which is between it and the admins.
      ...this.complaintFields(ownComplaint),
      canComplain:
        (isCustomer || booking.technician?.userId === userId) && !ownComplaint && COMPLAINABLE_STATUSES.includes(booking.status),
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
      ...(booking.assignmentMode === 'OPEN_MARKETPLACE' && (isCustomer || booking.customerId === userId)
        ? {
            applications: (booking.applications ?? []).map((application: any) => ({
              applicationId: application.id,
              technicianId: application.technicianProfileId,
              displayName: application.technicianProfile?.user?.displayName ?? null,
              avatarUrl: application.technicianProfile?.user?.avatarUrl ?? null,
              // Lets the customer compare where each applicant's facility is before choosing.
              facility: booking.mode === 'ONSITE' ? facilityLocation(application.technicianProfile) : null,
              averageRating: Number(application.technicianProfile?.averageRating ?? 0),
              reviewCount: application.technicianProfile?.reviewCount ?? 0,
              distanceKm: kmBetween(booking.address, application.technicianProfile),
              // What choosing this technician adds to the total, so the customer sees it before picking.
              travelFee: travelRules
                ? travelFeeFor(booking.mode, kmBetween(booking.address, application.technicianProfile), travelRules)
                : 0,
              isAvailable: Boolean(application.technicianProfile?.isAvailable),
              badge: technicianBadge(application.technicianProfile),
              status: application.status,
              isSelected: application.status === 'SELECTED',
              isApplicant: application.status === 'APPLIED',
              appliedAt: application.appliedAt ?? application.createdAt,
            })),
          }
        : {}),
    };
  }

  private complaintFields(complaint: any) {
    return {
      complaint: complaint
        ? {
            id: complaint.id,
            status: complaint.status,
            statusLabel: COMPLAINT_STATUS_LABEL[complaint.status] ?? complaint.status,
            reasonCode: complaint.reasonCode,
            createdAt: complaint.createdAt,
            conversationId: complaint.conversation?.id ?? null,
          }
        : null,
    };
  }

  private technicianJobResponse(booking: any, userId: string, commissionPercent?: number) {
    const base = this.historyResponse(booking, userId);
    return {
      ...base,
      ...this.technicianRequestMetadata(booking, booking.technicianId),
      isSelected: ['CONFIRMED', 'COMPLETED'].includes(booking.status),
      isApplicant: false,
      jobState: booking.status === 'PENDING' ? 'NEW' : booking.status === 'CONFIRMED' ? 'ACCEPTED' : booking.status,
      // A direct booking always names this technician, so a pending one is a 'Khách đặt bạn' card.
      displayStatus: booking.status === 'PENDING' ? 'REQUESTED' : booking.status === 'CONFIRMED' ? 'ACCEPTED' : booking.status,
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
      // A pending direct booking is not charged yet: show the earning after today's commission.
      pricing: this.technicianPricing(booking, booking.status === 'PENDING' ? commissionPercent : undefined),
    };
  }

  private technicianRequestMetadata(booking: any, viewerTechnicianId: string) {
    const requestedTechnicianId = booking.requestedTechnicianId ??
      (booking.assignmentMode === 'DIRECT' ? booking.technicianId : null);
    const isRequestedTechnician = Boolean(requestedTechnicianId && requestedTechnicianId === viewerTechnicianId);
    return {
      requestedTechnicianId: requestedTechnicianId ?? null,
      isRequestedTechnician,
      requestType: isRequestedTechnician ? 'CUSTOMER_REQUEST' : 'MARKETPLACE',
      requestLabel: isRequestedTechnician ? 'Khách đặt bạn' : 'Yêu cầu mới',
    };
  }

  /**
   * With `estimatePercent` (jobs not yet theirs) the fee is what the technician would be charged at today's
   * rate, so "Bạn sẽ nhận được" already has the commission taken off; otherwise it is what was charged.
   */
  /**
   * What changes hands for the technician: the customer pays `customerPaysAmount` (after the voucher); the wallet pays
   * `platformFee` when the job is taken and is credited `discountAmount` when it is completed. `netToPlatform` < 0
   * means the platform pays the technician overall.
   */
  private settlement(booking: any, platformFee: number) {
    // A prepaid online booking: nothing goes through the wallet. The platform holds the customer's money and bears the
    // voucher itself, so there is no voucher credit; the technician gets the price minus the commission.
    const prepaid = booking.mode === 'ONLINE' && (booking.payment?.method ?? 'ONLINE') === 'ONLINE';
    const discountAmount = prepaid ? 0 : Math.round(Number(booking.discountAmount ?? 0));
    return {
      discountAmount,
      customerPaysAmount: Number(booking.totalAmount ?? 0),
      netToPlatform: platformFee - discountAmount,
    };
  }

  private technicianPricing(booking: any, estimatePercent?: number, estimatedTravelFee = 0) {
    const gross = booking.grossServiceAmount === null || booking.grossServiceAmount === undefined ? null : Number(booking.grossServiceAmount);
    if (estimatePercent !== undefined && gross !== null) {
      const platformFee = roundVnd((gross * estimatePercent) / 100);
      // A direct booking already carries its fee; an open one gets it only when a technician is chosen.
      const travelFee = Number(booking.travelFee ?? 0) || estimatedTravelFee;
      const serviceFee = Number(booking.serviceFee ?? 0);
      return {
        grossServiceAmount: gross,
        platformFee,
        serviceFee,
        travelFee,
        ...this.settlement(booking, platformFee),
        technicianEarning: gross - platformFee + serviceFee + travelFee,
        isEstimate: true,
        currency: 'VND',
      };
    }
    return {
      isEstimate: false,
      ...this.settlement(booking, Number(booking.platformFee ?? 0)),
      serviceFee: Number(booking.serviceFee ?? 0),
      travelFee: Number(booking.travelFee ?? 0),
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

  /** Takes one use of the voucher atomically, so two bookings cannot both consume its last use. */
  private async reservePromotion(tx: Prisma.TransactionClient, promotionId: string, usageLimit: number | null) {
    const now = new Date();
    const reserved = await tx.promotion.updateMany({
      where: {
        id: promotionId,
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
        ...(usageLimit === null ? {} : { usageLimit, usedCount: { lt: usageLimit } }),
      },
      data: { usedCount: { increment: 1 } },
    });
    if (!reserved.count) throw new BadRequestException('Mã khuyến mãi đã hết lượt sử dụng');
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
    if (!promotion) throw new BadRequestException('Mã khuyến mãi không hợp lệ hoặc đã hết hạn');
    if (subtotal < Number(promotion.minOrderAmount))
      throw new BadRequestException('Đơn hàng chưa đạt giá trị tối thiểu');
    const userUses = await db.promotionUsage.count({ where: { promotionId: promotion.id, userId } });
    if (
      userUses >= promotion.perUserLimit ||
      (promotion.usageLimit !== null && promotion.usedCount >= promotion.usageLimit)
    )
      throw new BadRequestException('Mã khuyến mãi đã hết lượt sử dụng');
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
          // Broadcast to every eligible technician at once. An application
          // is created only when that technician explicitly taps Apply.
          await this.announceOpenBooking(booking, candidate);
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

  /** "Khách đặt bạn" for the technician the customer picked, "Yêu cầu mới" for the rest. */
  private announceOpenBooking(booking: any, candidate: { id: string; userId: string }) {
    const requested = Boolean(booking.requestedTechnicianId) && booking.requestedTechnicianId === candidate.id;
    return this.notifyStatus(
      candidate.userId,
      booking.id,
      requested ? 'OPEN_BOOKING_REQUESTED' : 'OPEN_BOOKING_AVAILABLE',
      requested ? 'Khách đặt bạn' : 'Yêu cầu mới',
      requested
        ? 'Khách hàng đã chọn bạn cho đơn dịch vụ mới. Hãy mở đơn để ứng tuyển hoặc từ chối.'
        : 'Có đơn dịch vụ mới phù hợp. Hãy mở tab Nhận việc để xem và ứng tuyển.',
      {
        requestType: requested ? 'CUSTOMER_REQUEST' : 'MARKETPLACE',
        requestLabel: requested ? 'Khách đặt bạn' : 'Yêu cầu mới',
      },
    );
  }

  /**
   * A technician just became free (their taken job was completed or cancelled). Open jobs created while they were busy
   * were not announced to them, so announce the ones still open that they can take now and were not told about.
   * Best effort: never throws, never fails the action that freed them.
   */
  async announceOpenJobsToFreedTechnician(technicianUserId: string | null | undefined) {
    if (!technicianUserId) return;
    try {
      const profile = await this.prisma.technicianProfile.findUnique({ where: { userId: technicianUserId }, select: { id: true, userId: true } });
      if (!profile) return;
      const now = new Date();
      const open = await this.prisma.booking.findMany({
        where: {
          assignmentMode: 'OPEN_MARKETPLACE',
          status: 'OPEN',
          OR: [{ applicationDeadlineAt: null }, { applicationDeadlineAt: { gt: now } }],
          applications: { none: { technicianProfileId: profile.id } },
        },
        include: { items: { include: { catalogService: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      if (!open.length) return;
      const told = await this.prisma.notification.findMany({
        where: {
          userId: technicianUserId,
          type: { in: ['OPEN_BOOKING_AVAILABLE', 'OPEN_BOOKING_REQUESTED'] },
          actionUrl: { in: open.map((booking) => `matxa://bookings/${booking.id}`) },
        },
        select: { actionUrl: true },
      });
      const toldIds = new Set(told.map((item) => item.actionUrl?.replace('matxa://bookings/', '')));
      for (const booking of open) {
        if (toldIds.has(booking.id)) continue;
        try {
          await this.assertOpenEligibility(this.prisma, booking, profile.id);
          await this.announceOpenBooking(booking, profile);
        } catch {
          // Not eligible for this one (area, mode, own booking…): skip it.
        }
      }
    } catch (error) {
      this.logger.warn(
        `Khong the bao don mo cho KTV vua ranh ${technicianUserId}: ${error instanceof Error ? error.message : 'khong ro ly do'}`,
      );
    }
  }

  private async notifyStatus(
    userId: string,
    bookingId: string,
    type: string,
    title: string,
    body: string,
    pushData: Record<string, string> = {},
  ) {
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
      await this.notifications.sendPush(userId, effectiveTitle, effectiveBody, { ...pushData, type, bookingId });
    } catch (error) {
      // FCM failure must not remove the in-app notification or fail booking creation.
      this.logger.warn(`Khong gui duoc push ${type}: ${error instanceof Error ? error.message : 'khong ro ly do'}`);
    }
  }
}

/**
 * Payment state for the apps. `awaitingPayment`: a technician took the online booking and the customer must pay before
 * `paymentDeadlineAt` (else it is cancelled); chat and contact open once paid.
 */
const PAYMENT_PRIVATE_FIELDS = [
  'payerBankBin',
  'payerBankName',
  'payerAccountNumber',
  'payerAccountName',
  'providerRef',
  'providerTransactionNo',
  'bankCode',
  'bankTranNo',
  'refundRef',
  'responseCode',
] as const;

function paymentView(payment: any, isCustomer: boolean) {
  if (!payment || isCustomer) return payment ?? null;
  const view = { ...payment };
  for (const field of PAYMENT_PRIVATE_FIELDS) delete view[field];
  return view;
}

function refundView(refund: any) {
  if (!refund) return null;
  return {
    status: refund.status as 'PENDING' | 'DONE',
    paidAmount: refund.paidAmount,
    feeAmount: refund.feeAmount,
    amount: refund.amount,
    createdAt: refund.createdAt,
    doneAt: refund.doneAt ?? null,
  };
}

function paymentFields(booking: any) {
  return {
    paymentStatus: booking.payment?.status ?? null,
    paymentDeadlineAt: booking.paymentDeadlineAt ?? null,
    awaitingPayment: isAwaitingPayment(booking),
  };
}

/** Bookings a user made as a customer that are not finished: waiting for a technician (before the deadline) or taken. */
function unfinishedAsCustomer(customerId: string): Prisma.BookingWhereInput {
  return {
    customerId,
    OR: [
      { status: 'CONFIRMED' },
      { status: { in: ['OPEN', 'PENDING'] }, OR: [{ applicationDeadlineAt: null }, { applicationDeadlineAt: { gt: new Date() } }] },
    ],
  };
}

/** Public location of a technician's facility for an ONSITE booking; null when the profile has none. */
function facilityLocation(profile: any) {
  if (!profile || (!profile.facility && !profile.address)) return null;
  const coordinate = (value: unknown) => (value === null || value === undefined ? null : Number(value));
  return {
    name: profile.facility ?? null,
    address: profile.address ?? null,
    city: profile.city ?? null,
    district: profile.district ?? null,
    // the point picked on the map; the technician's phone position (latitude/longitude) is not the facility
    latitude: coordinate(profile.facilityLatitude),
    longitude: coordinate(profile.facilityLongitude),
  };
}

/** The facility as it was when the technician took the booking (stored in the booking), if any. */
function bookedFacility(booking: { addressSnapshot?: unknown }) {
  const snapshot = booking.addressSnapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return undefined;
  return (snapshot as { facility?: ReturnType<typeof facilityLocation> }).facility;
}
