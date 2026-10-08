import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UpdateTechnicianApplicationDto } from '../dto/technician-application.dto';
import { TechnicianApplicationStorageService } from './technician-application-storage.service';
import { NotificationsService } from '../../notifications/services/notifications.service';

@Injectable()
export class TechnicianApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: TechnicianApplicationStorageService,
    private readonly notifications: NotificationsService,
  ) {}
  async getMine(userId: string) {
    const app = await this.prisma.technicianApplication.findUnique({
      where: { userId },
      include: { gallery: { orderBy: { sortOrder: 'asc' } }, kyc: { include: { documents: true } } },
    });
    if (!app) return null;
    const legacyDocuments = [
      { type: 'ID_CARD_FRONT', storageKey: app.idCardFrontKey },
      { type: 'ID_CARD_BACK', storageKey: app.idCardBackKey },
      { type: 'FACE', storageKey: app.faceImageKey },
    ].filter((item): item is { type: string; storageKey: string } => Boolean(item.storageKey));
    const [gallery, documents] = await Promise.all([
      Promise.all(
        app.gallery.map(async (image) => ({
          ...image,
          ...(await this.storage.createPrivateViewUrl(image.storageKey)),
        })),
      ),
      Promise.all(
        legacyDocuments.map(async (document) => ({
          ...document,
          ...(await this.storage.createPrivateViewUrl(document.storageKey)),
        })),
      ),
    ]);
    return { ...app, gallery, documents };
  }
  async createMine(userId: string, dto: UpdateTechnicianApplicationDto) {
    const existing = await this.prisma.technicianApplication.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.updateMine(userId, dto);
  }
  async updateMine(userId: string, dto: UpdateTechnicianApplicationDto) {
    if (dto.displayName !== undefined && !dto.displayName.trim())
      throw new BadRequestException('Ho ten khong duoc de trong');
    const current = await this.prisma.technicianApplication.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    if (current.status === 'SUBMITTED' || current.status === 'UNDER_REVIEW' || current.status === 'APPROVED')
      throw new ConflictException('Ho so dang cho duyet hoac da duoc duyet');
    const keys = ['idCardFrontKey', 'idCardBackKey', 'faceImageKey'] as const;
    for (const key of keys)
      if (dto[key] !== undefined && !dto[key]!.startsWith(`technician-applications/${userId}/`))
        throw new BadRequestException('Document key khong hop le');
    const modes = dto.supportedModes ?? current.supportedModes;
    const city = dto.city ?? current.city;
    const district = dto.district ?? current.district;
    if (city && district) {
      const validDistrict = await this.prisma.district.findFirst({
        where: { code: district, cityCode: city, isActive: true },
      });
      if (!validDistrict) throw new BadRequestException('Quan/huyen khong thuoc thanh pho da chon');
    }
    if (modes.includes('ONSITE') && !(dto.facility ?? current.facility)?.trim())
      throw new BadRequestException('Phuc vu tai co so can co thong tin co so');
    if (modes.includes('ONSITE') && !(dto.address ?? current.address)?.trim())
      throw new BadRequestException('Phuc vu tai co so can co dia chi');
    return this.prisma.technicianApplication.update({
      where: { userId },
      data: {
        ...dto,
        displayName: dto.displayName?.trim(),
        city: dto.city?.trim(),
        district: dto.district?.trim(),
        facility: dto.facility?.trim(),
        address: dto.address?.trim(),
        bio: dto.bio?.trim(),
        status: 'DRAFT',
      },
    });
  }
  uploadUrl(userId: string, dto: Parameters<TechnicianApplicationStorageService['createUploadUrl']>[1]) {
    return this.storage.createUploadUrl(userId, dto);
  }
  galleryUploadUrl(userId: string, dto: { contentType: string; size: number }) {
    return this.storage.createGalleryUploadUrl(userId, dto);
  }
  async addGalleryImage(userId: string, storageKey: string, sortOrder = 0) {
    if (!storageKey.startsWith(`technician-applications/${userId}/gallery/`))
      throw new BadRequestException('Gallery key khong hop le');
    const app = await this.prisma.technicianApplication.upsert({ where: { userId }, create: { userId }, update: {} });
    if (app.status === 'SUBMITTED' || app.status === 'UNDER_REVIEW' || app.status === 'APPROVED')
      throw new ConflictException('Khong the sua gallery khi ho so dang cho duyet hoac da duoc duyet');
    const count = await this.prisma.technicianApplicationGalleryImage.count({ where: { applicationId: app.id } });
    if (count >= 6) throw new BadRequestException('Toi da 6 anh gallery');
    return this.prisma.technicianApplicationGalleryImage.create({
      data: { applicationId: app.id, storageKey, sortOrder },
    });
  }
  async removeGalleryImage(userId: string, imageId: string) {
    const result = await this.prisma.technicianApplicationGalleryImage.deleteMany({
      where: { id: imageId, application: { userId } },
    });
    if (!result.count) throw new NotFoundException('Anh gallery khong ton tai');
  }
  async submit(userId: string) {
    const app = await this.prisma.technicianApplication.findUnique({ where: { userId } });
    if (!app) throw new NotFoundException('Chua co ho so dang ky');
    if (!app.displayName || !app.idCardFrontKey || !app.idCardBackKey || !app.faceImageKey)
      throw new BadRequestException('Vui long bo sung du thong tin va anh giay to');
    if (app.status === 'APPROVED') throw new ConflictException('Ho so da duoc duyet');
    const result = await this.prisma.technicianApplication.update({
      where: { userId },
      data: { status: 'SUBMITTED', rejectionReason: null, submittedAt: new Date() },
    });
    await this.prisma.technicianKyc.upsert({
      where: { applicationId: app.id },
      create: { applicationId: app.id, status: 'PENDING_VERIFICATION' },
      update: { status: 'PENDING_VERIFICATION', rejectionReason: null },
    });
    return result;
  }
  list(query: { status?: string; page: number; limit: number }) {
    const where = query.status ? { status: query.status as any } : {};
    return Promise.all([
      this.prisma.technicianApplication.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
          kyc: { select: { status: true } },
        },
      }),
      this.prisma.technicianApplication.count({ where }),
    ]).then(([items, total]) => ({ items, total, page: query.page, limit: query.limit }));
  }
  async detail(id: string) {
    const app = await this.prisma.technicianApplication.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true, role: true } },
        gallery: { orderBy: { sortOrder: 'asc' } },
        kyc: { include: { documents: true } },
      },
    });
    if (!app) throw new NotFoundException('Ho so khong ton tai');
    const legacy = [app.idCardFrontKey, app.idCardBackKey, app.faceImageKey].filter((key): key is string =>
      Boolean(key),
    );
    const signedKyc = await Promise.all(
      legacy.map(async (storageKey) => ({ storageKey, ...(await this.storage.createPrivateViewUrl(storageKey)) })),
    );
    return { ...app, signedKyc };
  }
  async reviewKyc(adminId: string, id: string, status: 'VERIFIED' | 'REJECTED', reason?: string) {
    if (status === 'REJECTED' && !reason?.trim()) throw new BadRequestException('Can nhap ly do tu choi KYC');
    const app = await this.prisma.technicianApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Ho so khong ton tai');
    const kyc = await this.prisma.technicianKyc.upsert({
      where: { applicationId: id },
      create: {
        applicationId: id,
        status,
        rejectionReason: status === 'REJECTED' ? reason!.trim() : null,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
      update: {
        status,
        rejectionReason: status === 'REJECTED' ? reason!.trim() : null,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });
    if (status === 'REJECTED')
      await this.notifications.create(
        app.userId,
        'TECHNICIAN_KYC_REJECTED',
        'KYC can bo sung',
        reason!.trim(),
        'matxa://technician/application',
      );
    return kyc;
  }
  async startReview(adminId: string, id: string) {
    const app = await this.prisma.technicianApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Ho so khong ton tai');
    if (app.status !== 'SUBMITTED') throw new ConflictException('Ho so khong o trang thai da gui');
    const now = new Date();
    return this.prisma.technicianApplication.update({
      where: { id },
      data: { status: 'UNDER_REVIEW', underReviewAt: now, reviewedBy: adminId, reviewedAt: now },
    });
  }
  async approve(adminId: string, id: string) {
    const app = await this.prisma.technicianApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Ho so khong ton tai');
    if (app.status !== 'SUBMITTED' && app.status !== 'UNDER_REVIEW')
      throw new ConflictException('Ho so khong o trang thai cho duyet');
    const result = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.user.update({ where: { id: app.userId }, data: { role: 'TECHNICIAN' } });
      await tx.technicianProfile.upsert({
        where: { userId: app.userId },
        create: {
          userId: app.userId,
          gender: app.gender,
          bio: app.bio,
          city: app.city,
          district: app.district,
          facility: app.facility,
          address: app.address,
          serviceModes: app.supportedModes.length ? app.supportedModes : ['HOME'],
          isVerified: true,
        },
        update: {
          gender: app.gender,
          bio: app.bio,
          city: app.city,
          district: app.district,
          facility: app.facility,
          address: app.address,
          serviceModes: app.supportedModes.length ? app.supportedModes : ['HOME'],
          isVerified: true,
        },
      });
      await tx.technicianKyc.updateMany({
        where: { applicationId: id },
        data: { status: 'VERIFIED', reviewedBy: adminId, reviewedAt: now },
      });
      return tx.technicianApplication.update({
        where: { id },
        data: { status: 'APPROVED', reviewedBy: adminId, reviewedAt: now, approvedAt: now, rejectionReason: null },
      });
    });
    await this.notifications.create(
      app.userId,
      'TECHNICIAN_APPLICATION_APPROVED',
      'Ho so KTV da duoc duyet',
      'Ban da co the bat dau cau hinh dich vu va lich lam viec.',
      'matxa://technician/application',
    );
    return result;
  }
  async reject(adminId: string, id: string, reason: string) {
    const app = await this.prisma.technicianApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Ho so khong ton tai');
    if (app.status !== 'SUBMITTED' && app.status !== 'UNDER_REVIEW')
      throw new ConflictException('Ho so khong o trang thai cho duyet');
    const now = new Date();
    const result = await this.prisma.technicianApplication.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason.trim(),
        rejectedAt: now,
        reviewedBy: adminId,
        reviewedAt: now,
      },
    });
    await this.prisma.technicianKyc.updateMany({
      where: { applicationId: id },
      data: { status: 'REJECTED', rejectionReason: reason.trim(), reviewedBy: adminId, reviewedAt: now },
    });
    await this.notifications.create(
      app.userId,
      'TECHNICIAN_APPLICATION_REJECTED',
      'Ho so KTV can bo sung',
      reason.trim(),
      'matxa://technician/application',
    );
    return result;
  }
}
