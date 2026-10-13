import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateServiceCatalogDto, ServiceCatalogQueryDto, UpdateServiceCatalogDto } from '../dto/service-catalog.dto';

@Injectable()
export class ServiceCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(query: ServiceCatalogQueryDto) {
    const items = await this.prisma.serviceCatalogItem.findMany({
      where: {
        isActive: true,
        category: { isActive: true },
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.mode ? { modes: { has: query.mode } } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search.trim(), mode: 'insensitive' } },
                { category: { name: { contains: query.search.trim(), mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        priceOptions: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { durationMinutes: 'asc' }] },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return items.map((item) => this.mobile(item));
  }

  listAdmin() {
    return this.prisma.serviceCatalogItem.findMany({
      include: { category: true, priceOptions: { orderBy: [{ sortOrder: 'asc' }, { durationMinutes: 'asc' }] } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async seedDefaults() {
    const groups = [
      { slug: 'massage-gian-co', name: 'Massage - Giãn cơ' },
      { slug: 'pt-fitness', name: 'PT / Fitness' },
      { slug: 'yoga-pilates', name: 'Yoga - Pilates' },
    ];
    const categories = new Map<string, string>();
    for (const group of groups) {
      const category = await this.prisma.serviceCategory.upsert({ where: { slug: group.slug }, update: { isActive: true }, create: group });
      categories.set(group.slug, category.id);
    }
    const defaults = [
      ['massage-co-vai-gay', 'Massage Cổ - vai - gáy', 'massage-gian-co'], ['massage-chan', 'Massage Chân', 'massage-gian-co'],
      ['massage-khong-dau', 'Massage Không đau', 'massage-gian-co'], ['massage-thai', 'Massage Thái', 'massage-gian-co'],
      ['massage-dau', 'Massage Đầu', 'massage-gian-co'], ['massage-the-thao', 'Massage thể thao', 'massage-gian-co'],
      ['stretching-tai-nha', 'Stretching tại nhà', 'massage-gian-co'], ['tap-tai-nha', 'Tập tại nhà', 'pt-fitness'],
      ['tap-tai-phong-gym', 'Tập tại phòng gym', 'pt-fitness'], ['phuc-hoi-van-dong', 'Phục hồi vận động', 'pt-fitness'],
      ['pt-online', 'PT online', 'pt-fitness'], ['yoga-pilates', 'Yoga - Pilates', 'yoga-pilates'],
    ] as const;
    let created = 0;
    for (const [slug, name, categorySlug] of defaults) {
      const exists = await this.prisma.serviceCatalogItem.findUnique({ where: { slug } });
      if (exists) continue;
      await this.create({ categoryId: categories.get(categorySlug)!, slug, name, pricingTemplate: 'STANDARD_60_90_120', modes: ['HOME'], priceOptions: [
        { code: '60_MINUTES', durationMinutes: 60, price: 500000, sortOrder: 0 },
        { code: '90_MINUTES', durationMinutes: 90, price: 600000, sortOrder: 1 },
        { code: '120_MINUTES', durationMinutes: 120, price: 700000, sortOrder: 2 },
      ] });
      created++;
    }
    return { created, total: defaults.length };
  }

  async create(dto: CreateServiceCatalogDto) {
    await this.category(dto.categoryId);
    this.validateTemplate(dto.pricingTemplate, dto.priceOptions);
    const primary = dto.priceOptions[0];
    return this.prisma.serviceCatalogItem.create({
      data: {
        categoryId: dto.categoryId,
        slug: dto.slug.trim().toLowerCase(),
        name: dto.name.trim(),
        description: dto.description?.trim(),
        modes: dto.modes,
        pricingTemplate: dto.pricingTemplate,
        durationMinutes: primary.durationMinutes,
        price: primary.price,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        priceOptions: {
          create: dto.priceOptions.map((item) => ({
            code: item.code.trim().toUpperCase(),
            durationMinutes: item.durationMinutes,
            price: item.price,
            sortOrder: item.sortOrder ?? 0,
            isActive: item.isActive ?? true,
          })),
        },
      },
      include: { category: true, priceOptions: true },
    });
  }

  async update(id: string, dto: UpdateServiceCatalogDto) {
    const current = await this.prisma.serviceCatalogItem.findUnique({ where: { id }, include: { priceOptions: true } });
    if (!current) throw new NotFoundException('Catalog service khong ton tai');
    if (dto.categoryId) await this.category(dto.categoryId);
    const options =
      dto.priceOptions ??
      current.priceOptions.map((item) => ({
        code: item.code,
        durationMinutes: item.durationMinutes,
        price: Number(item.price),
        sortOrder: item.sortOrder,
        isActive: item.isActive,
      }));
    this.validateTemplate(dto.pricingTemplate ?? current.pricingTemplate, options);
    const primary = options[0];
    return this.prisma.$transaction(async (tx) => {
      await tx.serviceCatalogPriceOption.deleteMany({ where: { catalogServiceId: id } });
      return tx.serviceCatalogItem.update({
        where: { id },
        data: {
          ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
          ...(dto.slug !== undefined ? { slug: dto.slug.trim().toLowerCase() } : {}),
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
          ...(dto.modes ? { modes: dto.modes } : {}),
          ...(dto.pricingTemplate ? { pricingTemplate: dto.pricingTemplate } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          durationMinutes: primary.durationMinutes,
          price: primary.price,
          priceOptions: {
            create: options.map((item) => ({
              code: item.code.trim().toUpperCase(),
              durationMinutes: item.durationMinutes,
              price: item.price,
              sortOrder: item.sortOrder ?? 0,
              isActive: item.isActive ?? true,
            })),
          },
        },
        include: { category: true, priceOptions: true },
      });
    });
  }

  async deactivate(id: string) {
    const item = await this.prisma.serviceCatalogItem.findUnique({ where: { id }, select: { id: true } });
    if (!item) throw new NotFoundException('Catalog service khong ton tai');
    // Deliberately soft-delete even when unused to preserve stable IDs and audit history.
    return this.prisma.serviceCatalogItem.update({ where: { id }, data: { isActive: false } });
  }

  private async category(id: string) {
    const category = await this.prisma.serviceCategory.findUnique({ where: { id } });
    if (!category) throw new BadRequestException('Category khong ton tai');
    return category;
  }
  private validateTemplate(template: string, options: Array<{ durationMinutes: number }>) {
    const expected: Record<string, number[]> = {
      STANDARD_60_90_120: [60, 90, 120],
      FIXED_60: [60],
      DATE_2_4_6_HOURS: [120, 240, 360],
    };
    const actual = options.map((item) => item.durationMinutes).sort((a, b) => a - b);
    if (
      actual.length !== expected[template].length ||
      actual.some((value, index) => value !== expected[template][index])
    )
      throw new BadRequestException('Price options khong dung pricing template');
  }
  private mobile(item: any) {
    return {
      id: item.id,
      category: item.category,
      name: item.name,
      description: item.description,
      supportedModes: item.modes,
      pricingTemplate: item.pricingTemplate,
      priceOptions: item.priceOptions.map((option: any) => ({
        id: option.id,
        code: option.code,
        durationMinutes: option.durationMinutes,
        price: Number(option.price),
      })),
    };
  }
}
