import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { PayosService } from '../bookings/services/payos.service';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly payos: PayosService,
  ) {}

  private bank() {
    const bankName = this.config.get<string>('WALLET_BANK_NAME');
    const accountName = this.config.get<string>('WALLET_BANK_ACCOUNT_NAME');
    const accountNumber = this.config.get<string>('WALLET_BANK_ACCOUNT_NUMBER');
    if (!bankName || !accountName || !accountNumber)
      throw new BadRequestException('Thong tin tai khoan nap tien chua duoc cau hinh');
    return { bankName, accountName, accountNumber };
  }
  private async wallet(userId: string) {
    const profile = await this.prisma.technicianProfile.findFirst({
      where: { userId, isActive: true, isVerified: true, user: { status: 'ACTIVE', role: 'TECHNICIAN' } },
      select: { id: true },
    });
    if (!profile) throw new ForbiddenException('Chi KTV da duoc duyet moi dung vi quang cao');
    return this.prisma.wallet.upsert({
      where: { userId_type: { userId, type: 'ADVERTISING_CREDIT' } },
      create: { userId, type: 'ADVERTISING_CREDIT' },
      update: {},
      include: { user: { select: { role: true } } },
    });
  }
  async balance(userId: string) {
    const wallet = await this.wallet(userId);
    return { id: wallet.id, type: wallet.type, balanceVnd: wallet.balanceVnd, currency: wallet.currency };
  }
  async create(userId: string, amount: number, paymentMethod = 'BANK_TRANSFER') {
    if (!Number.isInteger(amount) || amount <= 0) throw new BadRequestException('So tien phai la so nguyen duong');
    const min = Number(this.config.get('WALLET_TOPUP_MIN_VND', 50000));
    const max = Number(this.config.get('WALLET_TOPUP_MAX_VND', 100000000));
    if (amount < min || amount > max) throw new BadRequestException(`So tien phai tu ${min} den ${max} VND`);
    if (!['BANK_TRANSFER', 'PAYOS'].includes(paymentMethod)) throw new BadRequestException('Phuong thuc thanh toan chua ho tro');
    const wallet = await this.wallet(userId);
    const ttlMinutes = paymentMethod === 'PAYOS'
      ? Number(this.config.get('PAYOS_PAYMENT_TTL_MINUTES', 15))
      : Number(this.config.get('WALLET_TOPUP_TTL_MINUTES', 30));
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
    let topUp: any;
    let referenceCode = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      referenceCode = `PSY${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      try {
        topUp = await this.prisma.topUpTransaction.create({
          data: {
            walletId: wallet.id,
            userId,
            amountVnd: amount,
            paymentMethod: paymentMethod as any,
            providerTransactionId: paymentMethod === 'PAYOS' ? `PENDING-${Date.now()}-${Math.floor(Math.random() * 1000)}` : undefined,
            referenceCode,
            expiresAt,
          },
        });
        break;
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2002' || attempt === 4) throw error;
      }
    }
    if (!topUp) throw new ConflictException('Khong the tao ma giao dich, vui long thu lai');
    const response: any = {
      transactionId: topUp.id,
      amount: amount,
      currency: 'VND',
      status: topUp.status,
      paymentMethod: topUp.paymentMethod,
      bank: paymentMethod === 'BANK_TRANSFER' ? this.bank() : undefined,
      referenceCode,
      transferContent: `NAP PSY ${referenceCode}`,
      expiresAt: topUp.expiresAt,
    };
    if (paymentMethod === 'PAYOS') {
      if (!this.payos.isConfigured()) throw new BadRequestException('PayOS chua duoc cau hinh');
      const orderCode = Date.now();
      const data = await this.payos.createPaymentLink({ orderCode, amount, description: `Nap vi ${referenceCode}`, reference: referenceCode });
      await this.prisma.topUpTransaction.update({ where: { id: topUp.id }, data: { providerTransactionId: String(orderCode) } });
      response.checkoutUrl = data.checkoutUrl;
      response.qrCode = data.qrCode ?? null;
      response.paymentMethod = 'PAYOS';
      response.accountNumber = data.accountNumber ?? null;
      response.accountName = data.accountName ?? null;
    }
    return response;
  }

  async processPayosWebhook(body: Record<string, unknown>) {
    const data: any = this.payos.verifyWebhook(body as any);
    const orderCode = data.orderCode != null ? String(data.orderCode) : null;
    if (!orderCode) throw new BadRequestException('Webhook PayOS thieu orderCode');
    const topUp = await this.prisma.topUpTransaction.findFirst({ where: { providerTransactionId: orderCode, paymentMethod: 'PAYOS' } });
    if (!topUp) throw new NotFoundException('Khong tim thay giao dich nap PayOS');
    // PayOS puts the webhook result (`code`, `success`) at the top level;
    // `data` contains the order and amount. Do not credit on a non-success event.
    const success = String(body.code ?? '') === '00' && body.success === true;
    if (!success) return { ok: true, status: topUp.status };
    if (Number(data.amount) !== topUp.amountVnd)
      throw new ConflictException('So tien webhook PayOS khong khop giao dich');
    return this.simulateInternal(topUp.id);
  }

  private async simulateInternal(id: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const topUp = await tx.topUpTransaction.findUniqueOrThrow({ where: { id } });
      if (topUp.status === 'SUCCESS') return topUp;
      if (['FAILED', 'EXPIRED', 'CANCELLED'].includes(topUp.status)) throw new ConflictException('Giao dich khong the cap nhat');
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: topUp.walletId } });
      const updated = await tx.wallet.update({ where: { id: wallet.id }, data: { balanceVnd: { increment: topUp.amountVnd } } });
      await tx.walletLedgerEntry.create({ data: { walletId: wallet.id, topUpId: topUp.id, type: 'TOP_UP', amountVnd: topUp.amountVnd, balanceBeforeVnd: wallet.balanceVnd, balanceAfterVnd: updated.balanceVnd, referenceType: 'TOP_UP', referenceId: topUp.id } });
      return tx.topUpTransaction.update({ where: { id }, data: { status: 'SUCCESS', processedAt: new Date() } });
    });
    return result;
  }
  async list(userId: string, page = 1, limit = 20) {
    const where = { userId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.topUpTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.topUpTransaction.count({ where }),
    ]);
    return { items, total, page, limit };
  }
  async detail(userId: string, id: string) {
    const item = await this.prisma.topUpTransaction.findFirst({ where: { id, userId } });
    if (!item) throw new NotFoundException('Giao dich khong ton tai');
    return { ...item, bank: this.bank(), transferContent: `NAP PSY ${item.referenceCode}` };
  }
  async simulate(adminId: string, id: string, success: boolean, reason?: string) {
    if (this.config.get('NODE_ENV') === 'production') throw new ForbiddenException('Simulation bi tat tren production');
    const result = await this.prisma.$transaction(async (tx) => {
      const topUp = await tx.topUpTransaction.findUnique({ where: { id } });
      if (!topUp) throw new NotFoundException('Giao dich khong ton tai');
      if (topUp.status === 'SUCCESS' || topUp.status === 'FAILED' || topUp.status === 'EXPIRED')
        return { topUp, notify: null };
      if (!success)
        return {
          topUp: await tx.topUpTransaction.update({
            where: { id },
            data: {
              status: 'FAILED',
              failureCode: 'SIMULATED_FAILURE',
              failureMessage: reason ?? 'Giao dich that bai',
              processedAt: new Date(),
            },
          }),
          notify: null,
        };
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: topUp.walletId } });
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balanceVnd: { increment: topUp.amountVnd } },
      });
      await tx.walletLedgerEntry.create({
        data: {
          walletId: wallet.id,
          topUpId: topUp.id,
          type: 'TOP_UP',
          amountVnd: topUp.amountVnd,
          balanceBeforeVnd: wallet.balanceVnd,
          balanceAfterVnd: updated.balanceVnd,
          referenceType: 'TOP_UP',
          referenceId: topUp.id,
        },
      });
      const done = await tx.topUpTransaction.update({
        where: { id },
        data: { status: 'SUCCESS', processedAt: new Date() },
      });
      return { topUp: done, notify: { userId: topUp.userId, amount: topUp.amountVnd } };
    });
    if (result.notify)
      void this.prisma.notification
        .create({
          data: {
            userId: result.notify.userId,
            type: 'WALLET_TOPUP_SUCCESS',
            title: 'Nạp tiền thành công',
            body: `Đã cộng ${result.notify.amount.toLocaleString('vi-VN')} VND vào số dư quảng cáo`,
            actionUrl: `matxa://wallet/topups/${id}`,
          },
        })
        .catch(() => undefined);
    return { ...result.topUp, idempotent: result.topUp.status === 'SUCCESS' && !result.notify };
  }

  async simulateProcessing(_adminId: string, id: string) {
    if (this.config.get('NODE_ENV') === 'production') throw new ForbiddenException('Simulation bi tat tren production');
    const result = await this.prisma.topUpTransaction.updateMany({
      where: { id, status: 'PENDING_PAYMENT' },
      data: { status: 'PROCESSING' },
    });
    if (!result.count) throw new ConflictException('Giao dich khong o trang thai cho thanh toan');
    return this.prisma.topUpTransaction.findUniqueOrThrow({ where: { id } });
  }

  async adminList(query: { status?: string; userId?: string; referenceCode?: string; page: number; limit: number }) {
    const where = {
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.referenceCode
        ? { referenceCode: { contains: query.referenceCode, mode: 'insensitive' as const } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.topUpTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.topUpTransaction.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }
  async adminDetail(id: string) {
    const item = await this.prisma.topUpTransaction.findUnique({
      where: { id },
      include: { wallet: true, ledgerEntries: true },
    });
    if (!item) throw new NotFoundException('Giao dich khong ton tai');
    return item;
  }
}
