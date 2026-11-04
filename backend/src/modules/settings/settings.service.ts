import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

export type PlatformInfo = { brandName: string; hotline: string; supportEmail: string };
/** 0 means "no limit" for both rules. */
export type BookingRules = { minAdvanceHours: number; maxDispatchRadiusKm: number };

const PLATFORM_KEYS: Record<keyof PlatformInfo, string> = {
  brandName: 'PLATFORM_BRAND_NAME',
  hotline: 'PLATFORM_HOTLINE',
  supportEmail: 'PLATFORM_SUPPORT_EMAIL',
};
const PLATFORM_DEFAULTS: PlatformInfo = { brandName: 'Psyocore', hotline: '', supportEmail: '' };
const BOOKING_KEYS: Record<keyof BookingRules, string> = {
  minAdvanceHours: 'BOOKING_MIN_ADVANCE_HOURS',
  maxDispatchRadiusKm: 'BOOKING_MAX_DISPATCH_RADIUS_KM',
};

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

  async getPlatformInfo(): Promise<PlatformInfo> {
    const stored = await this.read(Object.values(PLATFORM_KEYS));
    return {
      brandName: stored.get(PLATFORM_KEYS.brandName) ?? PLATFORM_DEFAULTS.brandName,
      hotline: stored.get(PLATFORM_KEYS.hotline) ?? PLATFORM_DEFAULTS.hotline,
      supportEmail: stored.get(PLATFORM_KEYS.supportEmail) ?? PLATFORM_DEFAULTS.supportEmail,
    };
  }

  async setPlatformInfo(values: Partial<PlatformInfo>) {
    await this.write(PLATFORM_KEYS, values);
    return this.getPlatformInfo();
  }

  async getBookingRules(): Promise<BookingRules> {
    const stored = await this.read(Object.values(BOOKING_KEYS));
    return {
      minAdvanceHours: Number(stored.get(BOOKING_KEYS.minAdvanceHours) ?? 0),
      maxDispatchRadiusKm: Number(stored.get(BOOKING_KEYS.maxDispatchRadiusKm) ?? 0),
    };
  }

  async setBookingRules(values: Partial<BookingRules>) {
    await this.write(BOOKING_KEYS, values);
    return this.getBookingRules();
  }

  /** What the customer and technician apps may read without signing in. */
  async publicSettings() {
    const [platform, booking] = await Promise.all([this.getPlatformInfo(), this.getBookingRules()]);
    return { ...platform, ...booking };
  }

  private async read(keys: string[]) {
    const rows = await this.prisma.systemSetting.findMany({ where: { key: { in: keys } } });
    return new Map(rows.map((row) => [row.key, row.value]));
  }

  private async write<T extends object>(keys: Record<keyof T, string>, values: Partial<T>) {
    const entries = (Object.keys(keys) as (keyof T)[])
      .filter((field) => values[field] !== undefined)
      .map((field) => ({ key: keys[field], value: String(values[field]).trim() }));
    await this.prisma.$transaction(
      entries.map(({ key, value }) =>
        this.prisma.systemSetting.upsert({ where: { key }, create: { key, value }, update: { value } }),
      ),
    );
  }
}
