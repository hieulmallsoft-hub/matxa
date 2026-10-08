import 'dotenv/config';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaPg } from '@prisma/adapter-pg';
import { AuthProvider, PrismaClient, ServiceMode, UserRole, UserStatus } from '../generated/prisma/client';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

async function userWithEmail(prisma: PrismaClient, email: string, displayName: string, role: UserRole) {
  const existing = await prisma.userIdentity.findUnique({
    where: { provider_providerSubject: { provider: AuthProvider.EMAIL, providerSubject: email } },
  });
  const passwordHash = await hashPassword('Demo@123');
  if (existing) {
    await prisma.userIdentity.update({ where: { id: existing.id }, data: { passwordHash, emailVerified: true } });
    return prisma.user.update({
      where: { id: existing.userId },
      data: { displayName, role, status: UserStatus.ACTIVE },
    });
  }
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { displayName, role, status: UserStatus.ACTIVE } });
    await tx.userIdentity.create({
      data: {
        userId: user.id,
        provider: AuthProvider.EMAIL,
        providerSubject: email,
        email,
        emailVerified: true,
        passwordHash,
      },
    });
    return user;
  });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL la bat buoc');
  const host = new URL(databaseUrl).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host))
    throw new Error('Script demo chi duoc phep chay voi database local.');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    await userWithEmail(prisma, 'admin@matxa.local', 'Matxa Admin', UserRole.ADMIN);

    const categories = await Promise.all([
      prisma.serviceCategory.upsert({
        where: { slug: 'pt-fitness' },
        update: { name: 'PT / Fitness', isActive: true, sortOrder: 1 },
        create: { name: 'PT / Fitness', slug: 'pt-fitness', sortOrder: 1 },
      }),
      prisma.serviceCategory.upsert({
        where: { slug: 'yoga-pilates' },
        update: { name: 'Yoga - Pilates', isActive: true, sortOrder: 2 },
        create: { name: 'Yoga - Pilates', slug: 'yoga-pilates', sortOrder: 2 },
      }),
      prisma.serviceCategory.upsert({
        where: { slug: 'massage-gian-co' },
        update: { name: 'Massage - Giãn cơ', isActive: true, sortOrder: 3 },
        create: { name: 'Massage - Giãn cơ', slug: 'massage-gian-co', sortOrder: 3 },
      }),
    ]);
    const [fitness, yoga, massage] = categories;
    const technicians = [
      {
        email: 'nguyen.mai.demo@matxa.local',
        name: 'Nguyễn Thị Mai',
        city: 'HN',
        district: 'BA_DINH',
        category: fitness,
        service: 'Tập tại nhà',
      },
      {
        email: 'tran.linh.demo@matxa.local',
        name: 'Trần Ngọc Linh',
        city: 'HCM',
        district: 'QUAN_1',
        category: yoga,
        service: 'Yoga cơ bản',
      },
      {
        email: 'le.an.demo@matxa.local',
        name: 'Lê Minh An',
        city: 'DN',
        district: 'HAI_CHAU',
        category: massage,
        service: 'Massage toàn thân',
      },
    ];

    for (const item of technicians) {
      const user = await userWithEmail(prisma, item.email, item.name, UserRole.TECHNICIAN);
      const application = await prisma.technicianApplication.upsert({
        where: { userId: user.id },
        update: {
          status: 'APPROVED',
          displayName: item.name,
          city: item.city,
          district: item.district,
          supportedModes: [ServiceMode.HOME],
          approvedAt: new Date(),
        },
        create: {
          userId: user.id,
          status: 'APPROVED',
          displayName: item.name,
          city: item.city,
          district: item.district,
          supportedModes: [ServiceMode.HOME],
          approvedAt: new Date(),
        },
      });
      await prisma.technicianKyc.upsert({
        where: { applicationId: application.id },
        update: { status: 'VERIFIED' },
        create: { applicationId: application.id, status: 'VERIFIED' },
      });
      const profile = await prisma.technicianProfile.upsert({
        where: { userId: user.id },
        update: {
          city: item.city,
          district: item.district,
          serviceModes: [ServiceMode.HOME],
          isActive: true,
          isAvailable: true,
          isVerified: true,
          averageRating: 4.8,
          reviewCount: 15,
        },
        create: {
          userId: user.id,
          city: item.city,
          district: item.district,
          serviceModes: [ServiceMode.HOME],
          isActive: true,
          isAvailable: true,
          isVerified: true,
          averageRating: 4.8,
          reviewCount: 15,
        },
      });
      await prisma.technicianService.deleteMany({ where: { technicianId: profile.id } });
      await prisma.technicianService.create({
        data: {
          technicianId: profile.id,
          categoryId: item.category.id,
          name: item.service,
          durationMinutes: 60,
          price: 500000,
          modes: [ServiceMode.HOME],
          isActive: true,
          priceOptions: {
            create: [
              { code: '60_MINUTES', durationMinutes: 60, price: 500000, sortOrder: 1 },
              { code: '90_MINUTES', durationMinutes: 90, price: 600000, sortOrder: 2 },
              { code: '120_MINUTES', durationMinutes: 120, price: 700000, sortOrder: 3 },
            ],
          },
        },
      });
    }
    console.info('Da tao local demo: admin va 3 KTV. Dang nhap Admin: admin@matxa.local / Demo@123');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
