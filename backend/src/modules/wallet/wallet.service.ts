import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private bank() { return { bankName: this.config.get('WALLET_BANK_NAME', 'Vietcombank'), accountName: this.config.get('WALLET_BANK_ACCOUNT_NAME', 'PSYCORE'), accountNumber: this.config.get('WALLET_BANK_ACCOUNT_NUMBER', '0123456789') }; }
  private async wallet(userId: string) { return this.prisma.wallet.upsert({ where: { userId_type: { userId, type: 'ADVERTISING_CREDIT' } }, create: { userId, type: 'ADVERTISING_CREDIT' }, update: {}, include: { user: { select: { role: true } } } }); }
  async balance(userId: string) { const wallet = await this.wallet(userId); return { id: wallet.id, type: wallet.type, balanceVnd: wallet.balanceVnd, currency: wallet.currency }; }
  async create(userId: string, amount: number, paymentMethod = 'BANK_TRANSFER') {
    if (!Number.isInteger(amount) || amount <= 0) throw new BadRequestException('So tien phai la so nguyen duong');
    const min = Number(this.config.get('WALLET_TOPUP_MIN_VND', 50000)); const max = Number(this.config.get('WALLET_TOPUP_MAX_VND', 100000000));
    if (amount < min || amount > max) throw new BadRequestException(`So tien phai tu ${min} den ${max} VND`);
    if (paymentMethod !== 'BANK_TRANSFER') throw new BadRequestException('Phuong thuc thanh toan chua ho tro');
    const wallet = await this.wallet(userId); const referenceCode = `${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const topUp = await this.prisma.topUpTransaction.create({ data: { walletId: wallet.id, userId, amountVnd: amount, paymentMethod: 'BANK_TRANSFER', referenceCode, expiresAt: new Date(Date.now() + 30 * 60_000) } });
    return { transactionId: topUp.id, amount: amount, currency: 'VND', status: topUp.status, paymentMethod: topUp.paymentMethod, bank: this.bank(), referenceCode, transferContent: `NAP PSY ${referenceCode}`, expiresAt: topUp.expiresAt };
  }
  async list(userId: string, page = 1, limit = 20) { const where = { userId }; const [items, total] = await this.prisma.$transaction([this.prisma.topUpTransaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }), this.prisma.topUpTransaction.count({ where })]); return { items, total, page, limit }; }
  async detail(userId: string, id: string) { const item = await this.prisma.topUpTransaction.findFirst({ where: { id, userId } }); if (!item) throw new NotFoundException('Giao dich khong ton tai'); return { ...item, bank: this.bank(), transferContent: `NAP PSY ${item.referenceCode}` }; }
  async simulate(adminId: string, id: string, success: boolean, reason?: string) {
    if (this.config.get('NODE_ENV') === 'production') throw new ForbiddenException('Simulation bi tat tren production');
    const result = await this.prisma.$transaction(async (tx) => {
      const topUp = await tx.topUpTransaction.findUnique({ where: { id } }); if (!topUp) throw new NotFoundException('Giao dich khong ton tai');
      if (topUp.status === 'SUCCESS' || topUp.status === 'FAILED' || topUp.status === 'EXPIRED') return topUp;
      if (!success) return tx.topUpTransaction.update({ where: { id }, data: { status: 'FAILED', failureCode: 'SIMULATED_FAILURE', failureMessage: reason ?? 'Giao dich that bai', processedAt: new Date() } });
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: topUp.walletId } }); const updated = await tx.wallet.update({ where: { id: wallet.id }, data: { balanceVnd: { increment: topUp.amountVnd } } });
      await tx.walletLedgerEntry.create({ data: { walletId: wallet.id, topUpId: topUp.id, type: 'TOP_UP', amountVnd: topUp.amountVnd, balanceBeforeVnd: wallet.balanceVnd, balanceAfterVnd: updated.balanceVnd, referenceType: 'TOP_UP', referenceId: topUp.id } });
      const done = await tx.topUpTransaction.update({ where: { id }, data: { status: 'SUCCESS', processedAt: new Date() } });
      await tx.notification.create({ data: { userId: topUp.userId, type: 'WALLET_TOPUP_SUCCESS', title: 'Nap tien thanh cong', body: `Da cong ${topUp.amountVnd.toLocaleString('vi-VN')} VND vao so du quang cao`, actionUrl: `matxa://wallet/topups/${id}` } });
      return done;
    }); return { ...result, idempotent: result.status === 'SUCCESS' };
  }
}
