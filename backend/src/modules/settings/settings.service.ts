import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

export type PlatformInfo = { brandName: string; hotline: string; supportEmail: string };
/**
 * 0 means "no limit" for the advance and radius rules. A home booking farther than `travelFeeThresholdKm`
 * between customer and technician adds `travelFeeAmount` (VND, 0 = no travel fee), paid in full to the technician.
 */
export type BookingRules = {
  minAdvanceHours: number;
  maxDispatchRadiusKm: number;
  travelFeeThresholdKm: number;
  travelFeeAmount: number;
  /** How long a new booking waits for technicians to accept before it expires. */
  confirmationWaitMinutes: number;
  /** Off until the apps can ask a technician for their phone; on, a technician without one cannot take bookings. */
  requireTechnicianPhone: boolean;
  /** "Phụ phí" added to every home booking (VND); the server's HOME_SERVICE_FEE until the admin sets one. */
  homeServiceFee: number;
  /** Completed bookings in a day (Viet Nam time) after which the technician's next bookings carry
   *  `dailyDiscountFeePercent` instead of the usual commission. 0 = off. */
  dailyDiscountThreshold: number;
  dailyDiscountFeePercent: number;
  /** "Nơi phục vụ" the admin has switched on. The apps hide the others; bookings and new KTV choices are refused. */
  enabledServiceModes: ServiceModeName[];
  /** Cancelling this many taken bookings within `cancelLimitWindowHours` suspends the person (see suspensionHours).
   *  0 = off. */
  cancelLimitCount: number;
  cancelLimitWindowHours: number;
  /** Length of each suspension level in hours: the 1st suspension lasts [0], a repeat [1]… (default 3h, 24h, 7 days).
   *  Beyond the last level the last length is used again and the admin is asked to review. */
  suspensionHours: number[];
  /** After this many days without a suspension the next one starts again at level 1. */
  suspensionResetDays: number;
  /** Online (video/chat) bookings are paid online after a technician takes them, within this many minutes. */
  onlinePaymentWaitMinutes: number;
  /** A customer cancelling a paid online booking after it was taken gets this % kept as a cancellation fee. */
  onlineCancelFeePercent: number;
  /** Technicians are paid out once their unpaid online earnings reach this (VND). */
  payoutMinimumVnd: number;
  /** Allowed price of a service package (catalog and technicians' own), VND. Lowered temporarily to test payments. */
  servicePriceMinVnd: number;
  servicePriceMaxVnd: number;
};
export const SERVICE_MODES = ['HOME', 'ONLINE', 'ONSITE'] as const;
export type ServiceModeName = (typeof SERVICE_MODES)[number];

const PLATFORM_KEYS: Record<keyof PlatformInfo, string> = {
  brandName: 'PLATFORM_BRAND_NAME',
  hotline: 'PLATFORM_HOTLINE',
  supportEmail: 'PLATFORM_SUPPORT_EMAIL',
};
const PLATFORM_DEFAULTS: PlatformInfo = { brandName: 'Psyocore', hotline: '', supportEmail: '' };
const BOOKING_KEYS: Record<keyof BookingRules, string> = {
  minAdvanceHours: 'BOOKING_MIN_ADVANCE_HOURS',
  maxDispatchRadiusKm: 'BOOKING_MAX_DISPATCH_RADIUS_KM',
  travelFeeThresholdKm: 'BOOKING_TRAVEL_FEE_THRESHOLD_KM',
  travelFeeAmount: 'BOOKING_TRAVEL_FEE_AMOUNT',
  confirmationWaitMinutes: 'BOOKING_CONFIRMATION_WAIT_MINUTES',
  requireTechnicianPhone: 'BOOKING_REQUIRE_TECHNICIAN_PHONE',
  homeServiceFee: 'BOOKING_HOME_SERVICE_FEE',
  dailyDiscountThreshold: 'BOOKING_DAILY_DISCOUNT_THRESHOLD',
  dailyDiscountFeePercent: 'BOOKING_DAILY_DISCOUNT_FEE_PERCENT',
  enabledServiceModes: 'BOOKING_ENABLED_SERVICE_MODES',
  cancelLimitCount: 'BOOKING_CANCEL_LIMIT_COUNT',
  cancelLimitWindowHours: 'BOOKING_CANCEL_LIMIT_WINDOW_HOURS',
  suspensionHours: 'SUSPENSION_HOURS',
  suspensionResetDays: 'SUSPENSION_RESET_DAYS',
  onlinePaymentWaitMinutes: 'ONLINE_PAYMENT_WAIT_MINUTES',
  onlineCancelFeePercent: 'ONLINE_CANCEL_FEE_PERCENT',
  payoutMinimumVnd: 'PAYOUT_MINIMUM_VND',
  servicePriceMinVnd: 'SERVICE_PRICE_MIN_VND',
  servicePriceMaxVnd: 'SERVICE_PRICE_MAX_VND',
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
    if (!Number.isInteger(value) || value < 0 || value > 100)
      throw new BadRequestException('Ty le KTV nhan phai la so nguyen tu 0 den 100');
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
      travelFeeThresholdKm: Number(stored.get(BOOKING_KEYS.travelFeeThresholdKm) ?? 10),
      travelFeeAmount: Number(stored.get(BOOKING_KEYS.travelFeeAmount) ?? 0),
      confirmationWaitMinutes: Number(stored.get(BOOKING_KEYS.confirmationWaitMinutes) ?? 10),
      requireTechnicianPhone: stored.get(BOOKING_KEYS.requireTechnicianPhone) === 'true',
      homeServiceFee: Number(stored.get(BOOKING_KEYS.homeServiceFee) ?? this.config.get('HOME_SERVICE_FEE', 100000)),
      dailyDiscountThreshold: Number(stored.get(BOOKING_KEYS.dailyDiscountThreshold) ?? 0),
      dailyDiscountFeePercent: Number(stored.get(BOOKING_KEYS.dailyDiscountFeePercent) ?? 20),
      enabledServiceModes: parseModes(stored.get(BOOKING_KEYS.enabledServiceModes)),
      cancelLimitCount: Number(stored.get(BOOKING_KEYS.cancelLimitCount) ?? 3),
      cancelLimitWindowHours: Number(stored.get(BOOKING_KEYS.cancelLimitWindowHours) ?? 24),
      suspensionHours: parseHours(stored.get(BOOKING_KEYS.suspensionHours)),
      suspensionResetDays: Number(stored.get(BOOKING_KEYS.suspensionResetDays) ?? 30),
      onlinePaymentWaitMinutes: Number(stored.get(BOOKING_KEYS.onlinePaymentWaitMinutes) ?? 15),
      onlineCancelFeePercent: Number(stored.get(BOOKING_KEYS.onlineCancelFeePercent) ?? 20),
      payoutMinimumVnd: Number(stored.get(BOOKING_KEYS.payoutMinimumVnd) ?? 100000),
      servicePriceMinVnd: Number(stored.get(BOOKING_KEYS.servicePriceMinVnd) ?? SERVICE_PRICE_DEFAULTS.min),
      servicePriceMaxVnd: Number(stored.get(BOOKING_KEYS.servicePriceMaxVnd) ?? SERVICE_PRICE_DEFAULTS.max),
    };
  }

  async setBookingRules(values: Partial<BookingRules>) {
    const current = await this.getBookingRules();
    const min = values.servicePriceMinVnd ?? current.servicePriceMinVnd;
    const max = values.servicePriceMaxVnd ?? current.servicePriceMaxVnd;
    if (min > max) throw new BadRequestException('Gia toi thieu khong duoc lon hon gia toi da');
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

export const SERVICE_PRICE_DEFAULTS = { min: 400_000, max: 1_000_000 };

/**
 * Every service price (catalog package or a technician's own) must be within the admin's range: 400.000-1.000.000đ by
 * default, lowered for a while to test payments with small amounts. 400 SERVICE_PRICE_OUT_OF_RANGE otherwise.
 */
export async function assertServicePrices(db: Pick<PrismaService, 'systemSetting'>, prices: Array<number | null | undefined>) {
  const rows = await db.systemSetting.findMany({ where: { key: { in: ['SERVICE_PRICE_MIN_VND', 'SERVICE_PRICE_MAX_VND'] } } });
  const stored = new Map(rows.map((row) => [row.key, Number(row.value)]));
  const min = stored.get('SERVICE_PRICE_MIN_VND') ?? SERVICE_PRICE_DEFAULTS.min;
  const max = stored.get('SERVICE_PRICE_MAX_VND') ?? SERVICE_PRICE_DEFAULTS.max;
  const vnd = (value: number) => value.toLocaleString('vi-VN');
  if (prices.some((price) => price !== null && price !== undefined && (price < min || price > max)))
    throw new BadRequestException({
      code: 'SERVICE_PRICE_OUT_OF_RANGE',
      message: `Gia dich vu phai tu ${vnd(min)}d den ${vnd(max)}d`,
      min,
      max,
    });
}

/** Stored as "3,24,168"; never set (or nothing valid) = the default 3h, 24h, 7 days. */
export function parseHours(value: string | undefined): number[] {
  const hours = (value ?? '').split(',').map((part) => Number(part.trim())).filter((hour) => Number.isInteger(hour) && hour > 0);
  return hours.length ? hours : [3, 24, 168];
}

/** Stored as "HOME,ONLINE"; never set (or nothing valid) = every mode on. */
export function parseModes(value: string | undefined): ServiceModeName[] {
  const modes = SERVICE_MODES.filter((mode) => (value ?? '').split(',').map((part) => part.trim()).includes(mode));
  return value === undefined || !modes.length ? [...SERVICE_MODES] : modes;
}

/** For services without SettingsService injected: the admin's enabled "nơi phục vụ". */
export async function readEnabledServiceModes(db: Pick<PrismaService, 'systemSetting'>) {
  const row = await db.systemSetting.findUnique({ where: { key: BOOKING_KEYS.enabledServiceModes } });
  return parseModes(row?.value);
}
