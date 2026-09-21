import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateAddressDto, CreateAvailabilityDto, CreateTechnicianServiceDto, SearchTechniciansDto, UpdateAddressDto, UpdateTechnicianServiceDto, UpsertTechnicianProfileDto } from '../dto/marketplace.dto';

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async home(latitude?: number, longitude?: number) {
    const now = new Date();
    const [banners, categories, technicians] = await Promise.all([
      this.prisma.homeBanner.findMany({
        where: { isActive: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] },
        orderBy: { sortOrder: 'asc' },
      }),
      this.categories(),
      this.searchTechnicians({ latitude, longitude, page: 1, limit: 10 }),
    ]);
    return { banners, categories, technicians: technicians.items };
  }

  categories() {
    return this.prisma.serviceCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async searchTechnicians(query: SearchTechniciansDto) {
    if ((query.latitude === undefined) !== (query.longitude === undefined)) {
      throw new BadRequestException('Can gui ca latitude va longitude');
    }
    const where = {
      ...(query.gender ? { gender: query.gender } : {}),
      ...(query.tag ? { tags: { has: query.tag } } : {}),
      ...(query.mode ? { serviceModes: { has: query.mode } } : {}),
      ...(query.available !== undefined ? { isAvailable: query.available } : {}),
      ...(query.search ? { user: { displayName: { contains: query.search, mode: 'insensitive' as const } } } : {}),
      ...(query.categoryId ? { services: { some: { categoryId: query.categoryId, isActive: true } } } : {}),
    };
    const hasLocation = query.latitude !== undefined && query.longitude !== undefined;
    const profiles = await this.prisma.technicianProfile.findMany({
      where,
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        services: { where: { isActive: true }, select: { price: true, durationMinutes: true }, take: 1 },
      },
      orderBy: [{ isAvailable: 'desc' }, { averageRating: 'desc' }],
      ...(hasLocation ? {} : { skip: (query.page - 1) * query.limit, take: query.limit }),
    });
    let items = profiles.map((profile) => ({
      id: profile.id,
      userId: profile.userId,
      displayName: profile.user.displayName,
      avatarUrl: profile.user.avatarUrl,
      gender: profile.gender,
      tags: profile.tags,
      serviceModes: profile.serviceModes,
      isVerified: profile.isVerified,
      isAvailable: profile.isAvailable,
      averageRating: Number(profile.averageRating),
      reviewCount: profile.reviewCount,
      city: profile.city,
      startingPrice: profile.services[0] ? Number(profile.services[0].price) : null,
      distanceKm: hasLocation && profile.latitude !== null && profile.longitude !== null
        ? this.distanceKm(query.latitude!, query.longitude!, Number(profile.latitude), Number(profile.longitude))
        : null,
    }));
    const total = hasLocation ? items.length : await this.prisma.technicianProfile.count({ where });
    if (hasLocation) {
      items.sort((a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER));
      items = items.slice((query.page - 1) * query.limit, query.page * query.limit);
    }
    return { items, total, page: query.page, limit: query.limit };
  }

  async technicianDetail(id: string) {
    const profile = await this.prisma.technicianProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        services: { where: { isActive: true }, include: { category: true }, orderBy: { price: 'asc' } },
        reviews: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } }, orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!profile) throw new NotFoundException('Ky thuat vien khong ton tai');
    return profile;
  }

  availability(id: string, from: string, to: string) {
    const start = new Date(from);
    const end = new Date(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new BadRequestException('Khoang thoi gian khong hop le');
    return this.prisma.availabilitySlot.findMany({
      where: { technicianId: id, isAvailable: true, startAt: { lt: end }, endAt: { gt: start } },
      orderBy: { startAt: 'asc' },
    });
  }

  async favorites(userId: string) {
    const rows = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { technician: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
    });
    return rows.map((row) => row.technician);
  }

  async addFavorite(userId: string, technicianId: string) {
    await this.requireTechnician(technicianId);
    return this.prisma.favorite.upsert({
      where: { userId_technicianId: { userId, technicianId } },
      create: { userId, technicianId }, update: {},
    });
  }

  async removeFavorite(userId: string, technicianId: string) {
    await this.prisma.favorite.deleteMany({ where: { userId, technicianId } });
  }

  async upsertMyProfile(userId: string, dto: UpsertTechnicianProfileDto) {
    await this.requireRole(userId, ['TECHNICIAN', 'ADMIN']);
    return this.prisma.technicianProfile.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
    });
  }

  async createMyService(userId: string, dto: CreateTechnicianServiceDto) {
    const profile = await this.myProfile(userId);
    return this.prisma.technicianService.create({ data: { technicianId: profile.id, ...dto } });
  }

  async updateMyService(userId: string, serviceId: string, dto: UpdateTechnicianServiceDto) {
    const profile = await this.myProfile(userId);
    const result = await this.prisma.technicianService.updateMany({ where: { id: serviceId, technicianId: profile.id }, data: dto });
    if (!result.count) throw new NotFoundException('Dich vu khong ton tai');
    return this.prisma.technicianService.findUniqueOrThrow({ where: { id: serviceId } });
  }

  async createAvailability(userId: string, dto: CreateAvailabilityDto) {
    const profile = await this.myProfile(userId);
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (endAt <= startAt || startAt <= new Date()) throw new BadRequestException('Khung gio phai o tuong lai va co thoi gian hop le');
    const overlap = await this.prisma.availabilitySlot.findFirst({ where: { technicianId: profile.id, startAt: { lt: endAt }, endAt: { gt: startAt } } });
    if (overlap) throw new BadRequestException('Khung gio bi trung');
    return this.prisma.availabilitySlot.create({ data: { technicianId: profile.id, startAt, endAt } });
  }

  async removeAvailability(userId: string, slotId: string) {
    const profile = await this.myProfile(userId);
    const result = await this.prisma.availabilitySlot.deleteMany({ where: { id: slotId, technicianId: profile.id } });
    if (!result.count) throw new NotFoundException('Khung gio khong ton tai');
  }

  addresses(userId: string) {
    return this.prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.create({ data: { userId, ...dto } });
    });
  }

  async updateAddress(userId: string, id: string, dto: UpdateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.address.findFirst({ where: { id, userId } });
      if (!found) throw new NotFoundException('Dia chi khong ton tai');
      if (dto.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.update({ where: { id }, data: dto });
    });
  }

  async removeAddress(userId: string, id: string) {
    const result = await this.prisma.address.deleteMany({ where: { id, userId } });
    if (!result.count) throw new NotFoundException('Dia chi khong ton tai');
  }

  private async myProfile(userId: string) {
    const profile = await this.prisma.technicianProfile.findUnique({ where: { userId } });
    if (!profile) throw new ForbiddenException('Tai khoan chua co ho so ky thuat vien');
    return profile;
  }

  private async requireTechnician(id: string) {
    const technician = await this.prisma.technicianProfile.findUnique({ where: { id }, select: { id: true } });
    if (!technician) throw new NotFoundException('Ky thuat vien khong ton tai');
  }

  private async requireRole(userId: string, roles: string[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user || !roles.includes(user.role)) throw new ForbiddenException('Ban khong co quyen thuc hien thao tac nay');
  }

  private distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const rad = (value: number) => value * Math.PI / 180;
    const dLat = rad(lat2 - lat1);
    const dLon = rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return Math.round((6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) * 10) / 10;
  }
}
