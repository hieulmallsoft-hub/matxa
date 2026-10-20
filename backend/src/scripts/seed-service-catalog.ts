import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, ServiceCatalogPricingTemplate, ServiceMode } from '../generated/prisma/client';

const standard = [
  { code: '60_MINUTES', durationMinutes: 60, price: 500000, sortOrder: 1 },
  { code: '90_MINUTES', durationMinutes: 90, price: 600000, sortOrder: 2 },
  { code: '120_MINUTES', durationMinutes: 120, price: 700000, sortOrder: 3 },
];
const fixed = [{ code: '60_MINUTES', durationMinutes: 60, price: 500000, sortOrder: 1 }];
const date = [
  { code: '2_HOURS', durationMinutes: 120, price: 500000, sortOrder: 1 },
  { code: '4_HOURS', durationMinutes: 240, price: 600000, sortOrder: 2 },
  { code: '6_HOURS', durationMinutes: 360, price: 700000, sortOrder: 3 },
];
type PriceSeed = { code: string; durationMinutes: number; price: number; sortOrder: number };
type CatalogSeed = { categorySlug: string; categoryName: string; slug: string; name: string; template: ServiceCatalogPricingTemplate; modes: ServiceMode[]; options: PriceSeed[] };
const service = (categorySlug: string, categoryName: string, slug: string, name: string, modes: ServiceMode[], template: ServiceCatalogPricingTemplate = ServiceCatalogPricingTemplate.STANDARD_60_90_120, options: PriceSeed[] = standard): CatalogSeed => ({ categorySlug, categoryName, slug, name, template, modes, options });
const many = (categorySlug: string, categoryName: string, values: string[][], modes: ServiceMode[], template: ServiceCatalogPricingTemplate = ServiceCatalogPricingTemplate.STANDARD_60_90_120, options: PriceSeed[] = standard) => values.map(([slug, name]) => service(categorySlug, categoryName, slug, name, modes, template, options));

const items: CatalogSeed[] = [
  ...many('massage-gian-co', 'Massage - Giãn cơ', [
    ['massage-co-vai-gay', 'Massage Cổ - vai - gáy'], ['massage-chan', 'Massage Chân'], ['massage-khong-dau', 'Massage Không dầu'],
    ['massage-thai', 'Massage Thái'], ['massage-dau', 'Massage Dầu'], ['massage-the-thao', 'Massage thể thao'], ['stretching-tai-nha', 'Stretching tại nhà'],
  ], [ServiceMode.HOME]),
  ...many('pt-fitness', 'PT / Fitness', [['tap-tai-nha', 'Tập tại nhà']], [ServiceMode.HOME]),
  ...many('pt-fitness', 'PT / Fitness', [['tap-tai-phong-gym', 'Tập tại phòng gym'], ['phuc-hoi-van-dong', 'Phục hồi vận động']], [ServiceMode.ONSITE]),
  ...many('pt-fitness', 'PT / Fitness', [['pt-online', 'PT online']], [ServiceMode.ONLINE]),
  ...many('yoga-pilates', 'Yoga - Pilates', [
    ['yoga-co-ban', 'Yoga cơ bản'], ['yoga-thu-gian', 'Yoga thư giãn'], ['yoga-tang-suc-manh', 'Yoga tăng sức mạnh'], ['pilates-co-ban', 'Pilates cơ bản'], ['pilates-phuc-hoi', 'Pilates phục hồi'], ['pilates-cai-thien-tu-the', 'Pilates cải thiện tư thế'],
  ], [ServiceMode.HOME]),
  ...many('coaching', 'Coaching', [
    ['coaching-hoc-tap', 'Coaching học tập'], ['coaching-nghe-nghiep', 'Coaching nghề nghiệp'], ['coaching-phat-trien-ban-than', 'Coaching phát triển bản thân'], ['coaching-moi-quan-he', 'Coaching mối quan hệ'], ['coaching-dinh-huong-cuoc-song', 'Coaching định hướng cuộc sống'], ['coaching-ky-nang-xa-hoi', 'Coaching kỹ năng xã hội'],
  ], [ServiceMode.HOME, ServiceMode.ONSITE, ServiceMode.ONLINE], ServiceCatalogPricingTemplate.FIXED_60, fixed),
  ...many('co-van', 'Cố vấn', [
    ['co-van-hoc-tap', 'Cố vấn học tập'], ['co-van-nghe-nghiep', 'Cố vấn nghề nghiệp'], ['co-van-phat-trien-ban-than', 'Cố vấn phát triển bản thân'], ['co-van-moi-quan-he', 'Cố vấn mối quan hệ'], ['co-van-dinh-huong-cuoc-song', 'Cố vấn định hướng cuộc sống'], ['co-van-ky-nang-xa-hoi', 'Cố vấn kỹ năng xã hội'],
  ], [ServiceMode.HOME, ServiceMode.ONSITE, ServiceMode.ONLINE], ServiceCatalogPricingTemplate.FIXED_60, fixed),
  ...many('tham-van', 'Tham vấn', [
    ['stress', 'Stress'], ['ap-luc-hoc-tap', 'Áp lực học tập'], ['ap-luc-cong-viec', 'Áp lực công việc'], ['lo-au', 'Lo âu'], ['cam-xuc-tieu-cuc', 'Cảm xúc tiêu cực'], ['moi-quan-he', 'Mối quan hệ'], ['gia-dinh', 'Gia đình'], ['tinh-yeu', 'Tình yêu'], ['khung-hoang-ca-nhan', 'Khủng hoảng cá nhân'], ['dinh-huong-ban-than', 'Định hướng bản thân'], ['thich-nghi-cuoc-song', 'Thích nghi cuộc sống'], ['tu-tin-long-tu-trong', 'Tự tin và lòng tự trọng'],
  ], [ServiceMode.HOME, ServiceMode.ONSITE, ServiceMode.ONLINE], ServiceCatalogPricingTemplate.FIXED_60, fixed),
  ...many('hen-ho', 'Hẹn hò', [
    ['tro-chuyen', 'Trò chuyện'], ['di-ca-phe', 'Đi cà phê'], ['an-uong', 'Ăn uống'], ['cung-tap-luyen', 'Cùng tập luyện'], ['tham-quan', 'Tham quan'], ['xem-phim', 'Xem phim'], ['tham-gia-workshop', 'Tham gia Workshop'], ['hoat-dong-theo-so-thich', 'Hoạt động theo sở thích'],
  ], [ServiceMode.HOME], ServiceCatalogPricingTemplate.DATE_2_4_6_HOURS, date),
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL la bat buoc');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  for (const item of items) {
    const category = await prisma.serviceCategory.upsert({ where: { slug: item.categorySlug }, update: { name: item.categoryName, isActive: true }, create: { slug: item.categorySlug, name: item.categoryName, isActive: true } });
    const first = item.options[0];
    await prisma.serviceCatalogItem.upsert({
      where: { slug: item.slug },
      update: { categoryId: category.id, name: item.name, pricingTemplate: item.template, modes: item.modes, durationMinutes: first.durationMinutes, price: first.price, isActive: true, priceOptions: { deleteMany: {}, create: item.options } },
      create: { categoryId: category.id, slug: item.slug, name: item.name, pricingTemplate: item.template, modes: item.modes, durationMinutes: first.durationMinutes, price: first.price, priceOptions: { create: item.options } },
    });
  }
  await prisma.$disconnect();
  console.log(`Seeded ${items.length} service catalog items`);
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
