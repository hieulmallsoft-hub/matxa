import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { VenueStorageService } from './venue-storage.service';
import { CreateVenueDto, UpdateVenueDto, VENUE_CATEGORIES, VenueQueryDto, VenueHourDto } from '../dto/venue.dto';

const include = {
  services: { where: { isActive: true } },
  hours: { orderBy: { dayOfWeek: 'asc' as const } },
  promotion: true,
};

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in km, rounded to one decimal like the app shows ("1.7 km"). */
const distanceKm = (fromLat: number, fromLng: number, toLat: number, toLng: number) => {
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
};

@Injectable()
export class VenueService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly storage?: VenueStorageService) {}

  async list(query: VenueQueryDto, includeInactive = false) {
    const venues = await this.prisma.venue.findMany({
      where: {
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
        category: query.category ?? { in: [...VENUE_CATEGORIES] },
        ...(query.city ? { city: query.city } : {}),
        ...(query.district ? { district: query.district } : {}),
        ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
        ...(query.minRating ? { rating: { gte: query.minRating } } : {}),
      },
      include,
      orderBy: [{ rating: 'desc' }, { reviewCount: 'desc' }],
    });
    const items = await Promise.all(venues.map((venue) => this.response(venue, query)));
    if (query.sort === 'distance' && this.hasOrigin(query))
      items.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    return items;
  }

  async detail(id: string, origin: Pick<VenueQueryDto, 'latitude' | 'longitude'> = {}) {
    const venue = await this.prisma.venue.findFirst({ where: { id, isActive: true, deletedAt: null }, include });
    if (!venue) throw new NotFoundException('Không tìm thấy địa điểm');
    return this.response(venue, origin);
  }

  async create(dto: CreateVenueDto) {
    const { services, hours, ...venue } = dto;
    this.validateHours(hours);
    await this.assertPromotion(dto.promotionId);
    const created = await this.prisma.venue.create({
      data: {
        ...venue,
        images: this.storedImages(dto.images) ?? [],
        services: services?.length ? { create: services } : undefined,
        hours: hours?.length ? { create: this.hoursData(hours) } : undefined,
      },
      include,
    });
    return this.response(created);
  }

  async update(id: string, dto: UpdateVenueDto) {
    const current = await this.prisma.venue.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Không tìm thấy địa điểm');
    const { services, hours, ...data } = dto;
    this.validateHours(hours);
    await this.assertPromotion(dto.promotionId);
    // Nested writes are atomic: replacing hours/services cannot leave a half-saved venue.
    const updated = await this.prisma.venue.update({
      where: { id },
      data: {
        ...data,
        ...(data.images ? { images: this.storedImages(data.images) } : {}),
        ...(services ? { services: { deleteMany: {}, create: services } } : {}),
        ...(hours ? { hours: { deleteMany: {}, create: this.hoursData(hours) } } : {}),
      },
      include,
    });
    return this.response(updated);
  }

  async remove(id: string) {
    const current = await this.prisma.venue.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Không tìm thấy địa điểm');
    await this.prisma.venue.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
    return { id, deleted: true };
  }

  private async assertPromotion(promotionId?: string | null) {
    if (!promotionId) return;
    const promotion = await this.prisma.promotion.findUnique({ where: { id: promotionId }, select: { id: true } });
    if (!promotion) throw new BadRequestException('Mã khuyến mãi không tồn tại');
  }

  private validateHours(hours?: VenueHourDto[] | null) {
    if (!hours) return;
    if (new Set(hours.map((hour) => hour.dayOfWeek)).size !== hours.length)
      throw new BadRequestException('Không được trùng ngày trong lịch mở cửa');
    for (const hour of hours) {
      if (!hour.isClosed && (!hour.openTime || !hour.closeTime || hour.openTime >= hour.closeTime))
        throw new BadRequestException('Giờ đóng cửa phải sau giờ mở cửa trong cùng ngày');
    }
  }

  private hoursData(hours: VenueHourDto[]) {
    return hours.map((hour) => ({
      ...hour,
      openTime: hour.isClosed ? null : hour.openTime,
      closeTime: hour.isClosed ? null : hour.closeTime,
    }));
  }

  private hasOrigin(origin: Pick<VenueQueryDto, 'latitude' | 'longitude'>) {
    return origin.latitude !== undefined && origin.longitude !== undefined;
  }

  /** Only a running, active promotion is shown as the venue's offer. */
  private offer(promotion: any, now = new Date()) {
    if (!promotion?.isActive || new Date(promotion.startsAt) > now || new Date(promotion.endsAt) <= now) return null;
    const value = Number(promotion.value);
    return {
      id: promotion.id,
      code: promotion.code,
      title: promotion.name,
      type: promotion.type,
      value,
      discountLabel: promotion.type === 'PERCENT' ? `-${value}%` : `-${value.toLocaleString('vi-VN')}đ`,
      minOrderAmount: Number(promotion.minOrderAmount ?? 0),
      maxDiscount: promotion.maxDiscount === null || promotion.maxDiscount === undefined ? null : Number(promotion.maxDiscount),
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
      description: promotion.description ?? null,
      terms: promotion.terms ?? null,
      note: promotion.note ?? null,
    };
  }

  private storedImages(images?: string[] | null) {
    return images?.map((url) => this.storage?.storedUrl(url) ?? url);
  }

  private async response(venue: any, origin: Pick<VenueQueryDto, 'latitude' | 'longitude'> = {}) {
    const { promotion, ...rest } = venue;
    const latitude = Number(venue.latitude);
    const longitude = Number(venue.longitude);
    return {
      ...rest,
      images: await Promise.all((venue.images ?? []).map((url: string) => this.storage?.viewUrl(url) ?? url)),
      rating: Number(venue.rating),
      latitude,
      longitude,
      phone: venue.phone ?? null,
      isVerified: Boolean(venue.isVerified),
      promotionId: venue.promotionId ?? null,
      offer: this.offer(promotion),
      distanceKm: this.hasOrigin(origin)
        ? distanceKm(origin.latitude!, origin.longitude!, latitude, longitude)
        : null,
      services: (venue.services ?? []).map((service: any) => ({ ...service, price: Number(service.price) })),
    };
  }
}
