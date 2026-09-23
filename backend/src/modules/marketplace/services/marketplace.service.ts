import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { TechnicianListResponse } from '../entities/marketplace.entity';
import { AvailabilityQueryDto, CreateAddressDto, CreateAvailabilityDto, CreateTechnicianServiceDto, MarketplaceHomeQueryDto, SearchTechniciansDto, UpdateAddressDto, UpdateTechnicianServiceDto, UpsertTechnicianProfileDto } from '../dto/marketplace.dto';
import { loadBookableServices, publicTechnicianWhere } from './technician-selection';
import { availabilityRange, BOOKING_TIMEZONE, buildAvailableSlots } from './availability-slots';

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async home(latitude?: number, longitude?: number, userId?: string) {
    const now = new Date();
    const [banners, categories, technicians] = await Promise.all([
      this.prisma.homeBanner.findMany({
        where: { isActive: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] },
        orderBy: { sortOrder: 'asc' },
      }),
      this.categories(),
      this.searchTechnicians({ latitude, longitude, page: 1, limit: 10 }, userId),
    ]);
    return { banners, categories, technicians: technicians.items };
  }

  categories() {
    return this.prisma.serviceCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async searchTechnicians(query: SearchTechniciansDto, userId?: string): Promise<TechnicianListResponse> {
    if ((query.latitude === undefined) !== (query.longitude === undefined)) {
      throw new BadRequestException('Can gui ca latitude va longitude');
    }
    const hasLocation = query.latitude !== undefined && query.longitude !== undefined;
    if (hasLocation && (!Number.isFinite(query.latitude) || !Number.isFinite(query.longitude) || Math.abs(query.latitude!) > 90 || Math.abs(query.longitude!) > 180)) {
      throw new BadRequestException('Toa do khong hop le');
    }
    const keyword = (query.search ?? query.keyword)?.trim();
    const tags = [...new Set([...(query.tags ?? []), ...(query.tag ? [query.tag] : [])].map((tag) => tag.trim()).filter(Boolean))];
    const conditions = [Prisma.sql`p.is_active = true`, Prisma.sql`u.status = 'ACTIVE'`];
    if (keyword) {
      // Escape LIKE wildcards so search text remains literal, and bind it as a parameter.
      const pattern = `%${keyword.replace(/[\\%_]/g, '\\$&')}%`;
      conditions.push(Prisma.sql`u.display_name ILIKE ${pattern}`);
    }
    if (query.gender) conditions.push(Prisma.sql`p.gender::text = ${query.gender}`);
    if (tags.length) conditions.push(Prisma.sql`p.tags @> ARRAY[${Prisma.join(tags)}]::text[]`);
    if (query.available !== undefined) conditions.push(Prisma.sql`p.is_available = ${query.available}`);
    if (query.mode) conditions.push(Prisma.sql`${query.mode} = ANY(p.service_modes::text[])`);
    const serviceConditions = [Prisma.sql`s.technician_id = p.id`, Prisma.sql`s.is_active = true`, Prisma.sql`c.is_active = true`];
    if (query.categoryId) serviceConditions.push(Prisma.sql`s.category_id = ${query.categoryId}::uuid`);
    if (query.serviceId) serviceConditions.push(Prisma.sql`s.id = ${query.serviceId}::uuid`);
    if (query.mode) serviceConditions.push(Prisma.sql`${query.mode} = ANY(s.modes::text[])`);
    // All service filters must match the same active service, not different services on one profile.
    conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM technician_services s JOIN service_categories c ON c.id = s.category_id WHERE ${Prisma.join(serviceConditions, ' AND ')})`);
    const distance = hasLocation ? Prisma.sql`
      CASE WHEN p.latitude IS NULL OR p.longitude IS NULL THEN NULL ELSE
        6371.0 * 2 * ASIN(SQRT(LEAST(1.0, GREATEST(0.0,
          POWER(SIN(RADIANS(p.latitude::double precision - ${query.latitude!}::double precision) / 2), 2)
          + COS(RADIANS(${query.latitude!}::double precision)) * COS(RADIANS(p.latitude::double precision))
          * POWER(SIN(RADIANS(p.longitude::double precision - ${query.longitude!}::double precision) / 2), 2)
        )))) END` : Prisma.sql`NULL::double precision`;
    const order = hasLocation
      ? Prisma.sql`distance ASC NULLS LAST, is_available DESC, average_rating DESC, id ASC`
      : Prisma.sql`is_available DESC, average_rating DESC, id ASC`;

    return this.prisma.$transaction(async (tx) => {
      // Count and page share the same filter. Empty pages still return the correct total.
      const [result] = await tx.$queryRaw<Array<{ total: bigint; ranked: Array<{ id: string; distance: number | null }> }>>(Prisma.sql`
        WITH filtered AS (
          SELECT p.id, p.is_available, p.average_rating, ${distance} AS distance
          FROM technician_profiles p JOIN users u ON u.id = p.user_id
          WHERE ${Prisma.join(conditions, ' AND ')}
        ), page AS (
          SELECT * FROM filtered ORDER BY ${order}
          LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}
        )
        SELECT (SELECT COUNT(*) FROM filtered) AS total,
          COALESCE(jsonb_agg(jsonb_build_object('id', id, 'distance', distance) ORDER BY ${order}), '[]'::jsonb) AS ranked
        FROM page
      `);
      const ids = result.ranked.map((row) => row.id);
      if (!ids.length) return { items: [], total: Number(result.total), page: query.page, limit: query.limit };
      const profiles = await tx.technicianProfile.findMany({
        where: { id: { in: ids } },
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
          services: {
            where: { isActive: true, category: { isActive: true },
              ...(query.categoryId ? { categoryId: query.categoryId } : {}),
              ...(query.serviceId ? { id: query.serviceId } : {}),
              ...(query.mode ? { modes: { has: query.mode } } : {}),
            },
            select: { price: true }, orderBy: [{ price: 'asc' }, { id: 'asc' }], take: 1,
          },
        },
      });
      const favorites = userId ? await tx.favorite.findMany({ where: { userId, technicianId: { in: ids } }, select: { technicianId: true } }) : [];
      const favoriteIds = new Set(favorites.map((favorite) => favorite.technicianId));
      const byId = new Map(profiles.map((profile) => [profile.id, profile]));
      const items = result.ranked.map(({ id, distance }) => {
        const profile = byId.get(id)!;
        return this.technicianCard(profile, favoriteIds.has(id), distance === null ? null : Math.round(distance * 10) / 10);
      });
      return { items, total: Number(result.total), page: query.page, limit: query.limit };
    }, { isolationLevel: 'RepeatableRead' });
  }

  async technicianDetail(id: string, location: MarketplaceHomeQueryDto = {}, userId?: string) {
    if ((location.latitude === undefined) !== (location.longitude === undefined)) throw new BadRequestException('Can gui ca latitude va longitude');
    const profile = await this.prisma.technicianProfile.findUnique({
      where: { id, ...publicTechnicianWhere },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        services: { where: { isActive: true, category: { isActive: true } }, include: { category: true }, orderBy: { price: 'asc' } },
        reviews: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20 },
      },
    });
    if (!profile) throw new NotFoundException('Ky thuat vien khong ton tai');
    const favorite = userId ? await this.prisma.favorite.findUnique({ where: { userId_technicianId: { userId, technicianId: id } }, select: { technicianId: true } }) : null;
    let distanceKm: number | null = null;
    if (location.latitude !== undefined && location.longitude !== undefined && profile.latitude !== null && profile.longitude !== null) {
      const rad = (value: number) => value * Math.PI / 180;
      const a = Math.sin(rad(Number(profile.latitude) - location.latitude) / 2) ** 2
        + Math.cos(rad(location.latitude)) * Math.cos(rad(Number(profile.latitude)))
        * Math.sin(rad(Number(profile.longitude) - location.longitude) / 2) ** 2;
      distanceKm = Math.round(6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a)))) * 10) / 10;
    }
    return {
      ...profile, ...this.technicianCard(profile, Boolean(favorite), distanceKm),
      images: profile.user.avatarUrl ? [profile.user.avatarUrl] : [],
      onsiteLocation: profile.serviceModes.includes('ONSITE') ? {
        address: profile.address, city: profile.city,
        latitude: profile.latitude === null ? null : Number(profile.latitude),
        longitude: profile.longitude === null ? null : Number(profile.longitude),
      } : null,
      services: profile.services.map((service) => ({ ...service, serviceId: service.id, technicianServiceId: service.id, price: Number(service.price) })),
    };
  }

  async availability(id: string, query: AvailabilityQueryDto) {
    const { start, end } = availabilityRange(query);
    await this.requireTechnician(id);
    if (!query.serviceIds) {
      if (query.mode || query.date) throw new BadRequestException('Can serviceIds va mode de lay slot trong');
      // Preserve the existing from/to-only working-schedule contract.
      return this.prisma.availabilitySlot.findMany({
        where: { technicianId: id, isAvailable: true, startAt: { lt: end }, endAt: { gt: start } },
        orderBy: { startAt: 'asc' },
      });
    }
    if (!query.mode) throw new BadRequestException('Can mode de lay slot trong');
    const services = await loadBookableServices(this.prisma, id, query.serviceIds, query.mode);
    const durationMinutes = services.reduce((sum, service) => sum + service.durationMinutes, 0);
    const [working, occupied] = await Promise.all([
      this.prisma.availabilitySlot.findMany({
        where: { technicianId: id, isAvailable: true, startAt: { lt: end }, endAt: { gt: start } },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.booking.findMany({
        where: { technicianId: id, status: { in: ['PENDING', 'CONFIRMED'] }, scheduledStart: { lt: end }, scheduledEnd: { gt: start } },
        select: { scheduledStart: true, scheduledEnd: true }, orderBy: { scheduledStart: 'asc' },
      }),
    ]);
    return { technicianId: id, serviceIds: services.map((service) => service.id), mode: query.mode,
      timezone: BOOKING_TIMEZONE, from: start, to: end, durationMinutes, stepMinutes: query.stepMinutes,
      slots: buildAvailableSlots(working, occupied.map((booking) => ({ startAt: booking.scheduledStart, endAt: booking.scheduledEnd })),
        durationMinutes, { startAt: start, endAt: end }, new Date(), query.stepMinutes),
    };
  }

  async favorites(userId: string) {
    const rows = await this.prisma.favorite.findMany({
      where: { userId, technician: publicTechnicianWhere },
      orderBy: { createdAt: 'desc' },
      include: { technician: { include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        services: { where: { isActive: true, category: { isActive: true } }, select: { price: true }, orderBy: { price: 'asc' }, take: 1 },
      } } },
    });
    return rows.map(({ technician }) => {
      const { services, ...profile } = technician;
      return { ...profile, ...this.technicianCard(technician, true) };
    });
  }

  async addFavorite(userId: string, technicianId: string) {
    await this.requireTechnician(technicianId);
    try {
      return await this.prisma.favorite.upsert({
        where: { userId_technicianId: { userId, technicianId } },
        create: { userId, technicianId }, update: {},
      });
    } catch (error) {
      // Prisma may emulate an upsert; concurrent adds must still be idempotent.
      if ((error as { code?: string })?.code !== 'P2002') throw error;
      return this.prisma.favorite.findUniqueOrThrow({ where: { userId_technicianId: { userId, technicianId } } });
    }
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
    return this.prisma.address.findMany({ where: { userId, deletedAt: null }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockAddressOwner(tx, userId);
      const currentDefault = await tx.address.findFirst({ where: { userId, deletedAt: null, isDefault: true }, select: { id: true } });
      const isDefault = dto.isDefault === true || !currentDefault;
      if (isDefault) await tx.address.updateMany({ where: { userId, deletedAt: null }, data: { isDefault: false } });
      return tx.address.create({ data: { userId, ...dto, isDefault } });
    });
  }

  async updateAddress(userId: string, id: string, dto: UpdateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockAddressOwner(tx, userId);
      const found = await tx.address.findFirst({ where: { id, userId, deletedAt: null } });
      if (!found) throw new NotFoundException('Dia chi khong ton tai');
      if (dto.isDefault) await tx.address.updateMany({ where: { userId, deletedAt: null }, data: { isDefault: false } });
      // Explicitly unsetting the current default selects another address if available.
      let nextDefault: { id: string } | null = null;
      if (found.isDefault && dto.isDefault === false) {
        nextDefault = await tx.address.findFirst({ where: { userId, deletedAt: null, id: { not: id } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true } });
      }
      const updated = await tx.address.update({ where: { id }, data: { ...dto, ...(found.isDefault && dto.isDefault === false && !nextDefault ? { isDefault: true } : {}) } });
      if (nextDefault) await tx.address.update({ where: { id: nextDefault.id }, data: { isDefault: true } });
      return updated;
    });
  }

  async removeAddress(userId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockAddressOwner(tx, userId);
      const found = await tx.address.findFirst({ where: { id, userId, deletedAt: null } });
      if (!found) throw new NotFoundException('Dia chi khong ton tai');
      await tx.address.update({ where: { id }, data: { deletedAt: new Date(), isDefault: false } });
      if (found.isDefault) {
        const replacement = await tx.address.findFirst({ where: { userId, deletedAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true } });
        if (replacement) await tx.address.update({ where: { id: replacement.id }, data: { isDefault: true } });
      }
    });
  }

  private async lockAddressOwner(tx: Prisma.TransactionClient, userId: string) {
    // Serialize default changes for one user, including when no address exists yet.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
  }

  private technicianCard(profile: Prisma.TechnicianProfileGetPayload<{ include: {
    user: { select: { id: true; displayName: true; avatarUrl: true } }; services: { select: { price: true } };
  } }>, isFavorite: boolean, distanceKm: number | null = null) {
    return { id: profile.id, technicianId: profile.id, userId: profile.userId,
      displayName: profile.user.displayName, avatarUrl: profile.user.avatarUrl,
      averageRating: Number(profile.averageRating), reviewCount: profile.reviewCount,
      tags: profile.tags, gender: profile.gender, city: profile.city, serviceModes: profile.serviceModes,
      isVerified: profile.isVerified, isAvailable: profile.isAvailable, isFavorite, distanceKm,
      startingPrice: profile.services[0] ? Number(profile.services[0].price) : null,
    };
  }

  private async myProfile(userId: string) {
    const profile = await this.prisma.technicianProfile.findUnique({ where: { userId } });
    if (!profile) throw new ForbiddenException('Tai khoan chua co ho so ky thuat vien');
    return profile;
  }

  private async requireTechnician(id: string) {
    const technician = await this.prisma.technicianProfile.findUnique({ where: { id, ...publicTechnicianWhere }, select: { id: true } });
    if (!technician) throw new NotFoundException('Ky thuat vien khong ton tai');
  }

  private async requireRole(userId: string, roles: string[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user || !roles.includes(user.role)) throw new ForbiddenException('Ban khong co quyen thuc hien thao tac nay');
  }

}
