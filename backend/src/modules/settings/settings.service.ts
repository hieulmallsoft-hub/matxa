import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async getCommission() {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: 'TECHNICIAN_SHARE_PERCENT' } });
    const fallbackFee = Number(this.config.get('TECHNICIAN_COMMISSION_RATE_PERCENT', 25));
    const technicianSharePercent = setting ? Number(setting.value) : 100 - fallbackFee;
    return { technicianSharePercent, platformFeePercent: 100 - technicianSharePercent };
  }

  async setCommission(value: number) {
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new BadRequestException('Ty le KTV nhan phai tu 0 den 100');
    await this.prisma.systemSetting.upsert({ where: { key: 'TECHNICIAN_SHARE_PERCENT' }, create: { key: 'TECHNICIAN_SHARE_PERCENT', value: String(value) }, update: { value: String(value) } });
    return this.getCommission();
  }

  async platformFeePercent() {
    return (await this.getCommission()).platformFeePercent;
  }
}
