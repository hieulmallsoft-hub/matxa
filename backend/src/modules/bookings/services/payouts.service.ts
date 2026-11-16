import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { SettingsService } from '../../settings/settings.service';
import { vietQrUrl } from './online-payment';

/**
 * Money the platform holds for online bookings: technicians' earnings, paid out by the admin's bank transfer (VietQR),
 * and refunds of cancelled paid bookings, also sent by hand.
 */
@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly settings?: SettingsService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  /** The technician's own view: what is waiting to be paid, and what was paid. */
  async technicianEarnings(userId: string) {
    const [unpaid, payouts, profile] = await Promise.all([
      this.prisma.technicianEarning.findMany({ where: { technicianUserId: userId, payoutId: null }, orderBy: { createdAt: 'desc' } }),
      this.prisma.technicianPayout.findMany({ where: { technicianUserId: userId }, orderBy: { paidAt: 'desc' }, take: 50 }),
      this.prisma.technicianProfile.findUnique({ where: { userId }, select: { bankBin: true, bankName: true, bankAccountNumber: true, bankAccountName: true } }),
    ]);
    return {
      unpaidTotal: unpaid.reduce((sum, item) => sum + item.amount, 0),
      minimumPayout: await this.minimum(),
      bankAccount: profile?.bankAccountNumber ? profile : null,
      unpaid: unpaid.map((item) => ({ bookingId: item.bookingId, grossAmount: item.grossAmount, commission: item.commission, amount: item.amount, createdAt: item.createdAt })),
      payouts: payouts.map((payout) => ({ id: payout.id, amount: payout.amount, paidAt: payout.paidAt, bankName: payout.bankName, accountNumber: payout.accountNumber, transferNote: payout.transferNote })),
    };
  }

  /**
   * Technicians to pay this round: their unpaid earnings added up (at least the minimum), with their bank account and a
   * VietQR the admin scans. `upTo` pins the earnings this amount covers, so ones recorded meanwhile wait for next time.
   */
  async pendingPayouts() {
    const minimum = await this.minimum();
    const groups = await this.prisma.technicianEarning.groupBy({
      by: ['technicianUserId'],
      where: { payoutId: null },
      _sum: { amount: true },
      _count: { _all: true },
      _max: { createdAt: true },
    });
    const due = groups.filter((group) => (group._sum.amount ?? 0) >= minimum && (group._sum.amount ?? 0) > 0);
    const [profiles, users] = await Promise.all([
      this.prisma.technicianProfile.findMany({
        where: { userId: { in: due.map((group) => group.technicianUserId) } },
        select: { userId: true, bankBin: true, bankName: true, bankAccountNumber: true, bankAccountName: true },
      }),
      this.prisma.user.findMany({ where: { id: { in: due.map((group) => group.technicianUserId) } }, select: { id: true, displayName: true } }),
    ]);
    return due
      .map((group) => {
        const profile = profiles.find((item) => item.userId === group.technicianUserId);
        const amount = group._sum.amount ?? 0;
        const transferNote = transferNoteFor(group.technicianUserId, group._max.createdAt!);
        return {
          technicianUserId: group.technicianUserId,
          displayName: users.find((user) => user.id === group.technicianUserId)?.displayName ?? null,
          amount,
          bookingCount: group._count._all,
          upTo: group._max.createdAt,
          bankBin: profile?.bankBin ?? null,
          bankName: profile?.bankName ?? null,
          accountNumber: profile?.bankAccountNumber ?? null,
          accountName: profile?.bankAccountName ?? null,
          transferNote,
          qrUrl: vietQrUrl(profile?.bankBin, profile?.bankAccountNumber, amount, transferNote, profile?.bankAccountName),
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }

  /** The admin transferred the money: record the payout and settle the earnings it covers (the amount must match). */
  async markPaid(adminId: string, technicianUserId: string, dto: { upTo: string; amount: number }) {
    const upTo = new Date(dto.upTo);
    if (!Number.isFinite(upTo.getTime())) throw new BadRequestException('upTo khong hop le');
    const payout = await this.prisma.$transaction(async (tx) => {
      const earnings = await tx.technicianEarning.findMany({
        where: { technicianUserId, payoutId: null, createdAt: { lte: upTo } },
        select: { id: true, amount: true },
      });
      const total = earnings.reduce((sum, item) => sum + item.amount, 0);
      if (!earnings.length) throw new NotFoundException('Khong con khoan nao can chi cho KTV nay');
      if (total !== Math.round(dto.amount))
        throw new ConflictException('So tien da thay doi, vui long tai lai danh sach truoc khi xac nhan');
      const profile = await tx.technicianProfile.findUnique({
        where: { userId: technicianUserId },
        select: { bankBin: true, bankName: true, bankAccountNumber: true, bankAccountName: true },
      });
      const created = await tx.technicianPayout.create({
        data: {
          technicianUserId,
          amount: total,
          bankBin: profile?.bankBin ?? null,
          bankName: profile?.bankName ?? null,
          accountNumber: profile?.bankAccountNumber ?? null,
          accountName: profile?.bankAccountName ?? null,
          transferNote: transferNoteFor(technicianUserId, upTo),
          paidById: adminId,
        },
      });
      const settled = await tx.technicianEarning.updateMany({
        where: { id: { in: earnings.map((item) => item.id) }, payoutId: null },
        data: { payoutId: created.id },
      });
      if (settled.count !== earnings.length) throw new ConflictException('Khoan chi da duoc xac nhan, vui long tai lai');
      return created;
    });
    void this.notify(technicianUserId, 'TECHNICIAN_PAYOUT_SENT', 'Đã chuyển tiền thu nhập', `Psyocore đã chuyển ${payout.amount.toLocaleString('vi-VN')}đ thu nhập đơn trực tuyến vào tài khoản của bạn.`);
    return payout;
  }

  async payoutHistory(limit = 100) {
    const payouts = await this.prisma.technicianPayout.findMany({ orderBy: { paidAt: 'desc' }, take: limit, include: { _count: { select: { earnings: true } } } });
    const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set(payouts.map((payout) => payout.technicianUserId))] } }, select: { id: true, displayName: true } });
    return payouts.map(({ _count, ...payout }) => ({ ...payout, bookingCount: _count.earnings, displayName: users.find((user) => user.id === payout.technicianUserId)?.displayName ?? null }));
  }

  /** Refunds to send (or sent), with the account the customer paid from and a VietQR when it is known. */
  async refunds(status: 'PENDING' | 'DONE' = 'PENDING') {
    const refunds = await this.prisma.bookingRefund.findMany({ where: { status }, orderBy: { createdAt: status === 'PENDING' ? 'asc' : 'desc' }, take: 200 });
    const [payments, users] = await Promise.all([
      this.prisma.payment.findMany({
        where: { bookingId: { in: refunds.map((refund) => refund.bookingId) } },
        select: { bookingId: true, payerBankBin: true, payerBankName: true, payerAccountNumber: true, payerAccountName: true, paidAt: true },
      }),
      this.prisma.user.findMany({ where: { id: { in: refunds.map((refund) => refund.customerId) } }, select: { id: true, displayName: true } }),
    ]);
    return refunds.map((refund) => {
      const payment = payments.find((item) => item.bookingId === refund.bookingId);
      const transferNote = `PSYOCORE HOAN ${refund.bookingId.slice(0, 8).toUpperCase()}`;
      return {
        ...refund,
        customerName: users.find((user) => user.id === refund.customerId)?.displayName ?? null,
        paidAt: payment?.paidAt ?? null,
        bankBin: payment?.payerBankBin ?? null,
        bankName: payment?.payerBankName ?? null,
        accountNumber: payment?.payerAccountNumber ?? null,
        accountName: payment?.payerAccountName ?? null,
        transferNote,
        qrUrl: vietQrUrl(payment?.payerBankBin, payment?.payerAccountNumber, refund.amount, transferNote, payment?.payerAccountName),
      };
    });
  }

  async markRefunded(adminId: string, refundId: string, note?: string) {
    const updated = await this.prisma.bookingRefund.updateMany({
      where: { id: refundId, status: 'PENDING' },
      data: { status: 'DONE', doneById: adminId, doneAt: new Date(), note: note?.trim() || null },
    });
    if (!updated.count) throw new NotFoundException('Khoan hoan tien khong ton tai hoac da hoan');
    const refund = await this.prisma.bookingRefund.findUniqueOrThrow({ where: { id: refundId } });
    await this.prisma.payment.updateMany({ where: { bookingId: refund.bookingId }, data: { status: 'REFUNDED', refundedAt: new Date() } });
    void this.notify(refund.customerId, 'BOOKING_REFUNDED', 'Đã hoàn tiền', `Psyocore đã hoàn ${refund.amount.toLocaleString('vi-VN')}đ cho đơn #${refund.bookingId.slice(0, 8).toUpperCase()}.`);
    return refund;
  }

  private async minimum() {
    return (await this.settings?.getBookingRules())?.payoutMinimumVnd ?? 100000;
  }

  private async notify(userId: string, type: string, title: string, body: string) {
    if (!this.notifications) return;
    try {
      await this.notifications.create(userId, type, title, body, 'matxa://notifications');
      await this.notifications.sendPush(userId, title, body, { type });
    } catch {
      // The money record is saved; a failed notification must not undo it.
    }
  }
}

/** Short, unique transfer note: technician + the last earning covered (banks cut long notes). */
function transferNoteFor(technicianUserId: string, upTo: Date) {
  const day = new Date(upTo.getTime() + 7 * 3_600_000).toISOString().slice(2, 10).replace(/-/g, '');
  return `PSYOCORE CHI ${technicianUserId.slice(0, 6).toUpperCase()} ${day}`;
}
