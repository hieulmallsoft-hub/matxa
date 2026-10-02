import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, ServiceCatalogPricingTemplate, ServiceMode } from '../generated/prisma/client';

const standard = [{ code: '60_MINUTES', durationMinutes: 60, price: 500000, sortOrder: 1 }, { code: '90_MINUTES', durationMinutes: 90, price: 600000, sortOrder: 2 }, { code: '120_MINUTES', durationMinutes: 120, price: 700000, sortOrder: 3 }];
const fixed = [{ code: '60_MINUTES', durationMinutes: 60, price: 500000, sortOrder: 1 }];
const date = [{ code: '2_HOURS', durationMinutes: 120, price: 700000, sortOrder: 1 }, { code: '4_HOURS', durationMinutes: 240, price: 1200000, sortOrder: 2 }, { code: '6_HOURS', durationMinutes: 360, price: 1700000, sortOrder: 3 }];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL la bat buoc');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const items = [
    ['massage-gian-co', 'Massage - Giãn cơ', 'massage-gian-co', ServiceCatalogPricingTemplate.STANDARD_60_90_120, standard],
    ['pt-fitness', 'PT / Fitness', 'pt-fitness', ServiceCatalogPricingTemplate.STANDARD_60_90_120, standard],
    ['yoga-pilates', 'Yoga - Pilates', 'yoga-pilates', ServiceCatalogPricingTemplate.STANDARD_60_90_120, standard],
    ['coaching', 'Coaching', 'coaching', ServiceCatalogPricingTemplate.FIXED_60, fixed],
    ['co-van', 'Cố vấn', 'co-van', ServiceCatalogPricingTemplate.FIXED_60, fixed],
    ['tham-van', 'Tham vấn', 'tham-van', ServiceCatalogPricingTemplate.FIXED_60, fixed],
    ['hen-ho', 'Hẹn hò', 'hen-ho', ServiceCatalogPricingTemplate.DATE_2_4_6_HOURS, date],
  ] as const;
  for (const [categorySlug, name, slug, pricingTemplate, options] of items) {
    const category = await prisma.serviceCategory.upsert({ where: { slug: categorySlug }, update: { name, isActive: true }, create: { slug: categorySlug, name, isActive: true } });
    const first = options[0];
    await prisma.serviceCatalogItem.upsert({ where: { slug }, update: { categoryId: category.id, name, pricingTemplate, modes: [ServiceMode.HOME], durationMinutes: first.durationMinutes, price: first.price, isActive: true, priceOptions: { deleteMany: {}, create: options } }, create: { categoryId: category.id, slug, name, pricingTemplate, modes: [ServiceMode.HOME], durationMinutes: first.durationMinutes, price: first.price, priceOptions: { create: options } } });
  }
  await prisma.$disconnect();
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
