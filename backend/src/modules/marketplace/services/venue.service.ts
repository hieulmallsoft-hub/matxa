import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateVenueDto, UpdateVenueDto, VenueQueryDto } from '../dto/venue.dto';

@Injectable()
export class VenueService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: VenueQueryDto, includeInactive = false) {
    return this.prisma.venue.findMany({
      where: { ...(includeInactive ? {} : { isActive: true }), ...(query.city ? { city: query.city } : {}), ...(query.district ? { district: query.district } : {}), ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}) },
      include: { services: { where: { isActive: true } }, hours: true },
      orderBy: [{ rating: 'desc' }, { reviewCount: 'desc' }],
    });
  }

  async detail(id: string) {
    const venue = await this.prisma.venue.findFirst({ where: { id, isActive: true }, include: { services: { where: { isActive: true } }, hours: true } });
    if (!venue) throw new NotFoundException('Khong tim thay dia diem');
    return venue;
  }

  create(dto: CreateVenueDto) {
    const { services, hours, ...venue } = dto;
    return this.prisma.venue.create({ data: { ...venue, images: dto.images ?? [], services: services?.length ? { create: services } : undefined, hours: hours?.length ? { create: hours } : undefined }, include: { services: true, hours: true } });
  }
  async update(id: string, dto: UpdateVenueDto) {
    const current = await this.prisma.venue.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Khong tim thay dia diem');
    const { services: _services, hours: _hours, ...data } = dto;
    return this.prisma.venue.update({ where: { id }, data });
  }
}
