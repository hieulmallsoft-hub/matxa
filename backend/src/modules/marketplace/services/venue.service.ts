import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateVenueDto, UpdateVenueDto, VenueQueryDto, VenueHourDto } from '../dto/venue.dto';

const include = { services: { where: { isActive: true } }, hours: { orderBy: { dayOfWeek: 'asc' as const } } };

@Injectable()
export class VenueService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: VenueQueryDto, includeInactive = false) {
    const venues = await this.prisma.venue.findMany({
      where: {
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
        ...(query.category ? { category: query.category } : {}),
        ...(query.city ? { city: query.city } : {}),
        ...(query.district ? { district: query.district } : {}),
        ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
      },
      include,
      orderBy: [{ rating: 'desc' }, { reviewCount: 'desc' }],
    });
    return venues.map((venue) => this.response(venue));
  }

  async detail(id: string) {
    const venue = await this.prisma.venue.findFirst({ where: { id, isActive: true, deletedAt: null }, include });
    if (!venue) throw new NotFoundException('Không tìm thấy địa điểm');
    return this.response(venue);
  }

  async create(dto: CreateVenueDto) {
    const { services, hours, ...venue } = dto;
    this.validateHours(hours);
    const created = await this.prisma.venue.create({
      data: {
        ...venue,
        images: dto.images ?? [],
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
    // Nested writes are atomic: replacing hours/services cannot leave a half-saved venue.
    const updated = await this.prisma.venue.update({
      where: { id },
      data: {
        ...data,
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

  private response(venue: any) {
    return {
      ...venue,
      rating: Number(venue.rating),
      latitude: Number(venue.latitude),
      longitude: Number(venue.longitude),
      services: (venue.services ?? []).map((service: any) => ({ ...service, price: Number(service.price) })),
    };
  }
}
