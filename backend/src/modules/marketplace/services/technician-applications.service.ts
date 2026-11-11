import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UpdateTechnicianApplicationDto } from '../dto/technician-application.dto';
import { TechnicianApplicationStorageService } from './technician-application-storage.service';
import { resolveLocationCodes } from './location-code';
import { readEnabledServiceModes } from '../../settings/settings.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { TechnicianContractService } from './technician-contract.service';
import { parseIdCardQr } from './id-card-qr';

const ADMIN_USER_SELECT = {
  id: true,
  displayName: true,
  avatarUrl: true,
  identities: { select: { phoneNumber: true, email: true } },
} as const;

/** Admin review needs a way to reach the applicant; flatten login identities to phone/email. */
function withContact<T extends { user: { identities: Array<{ phoneNumber: string | null; email: string | null }> } }>(app: T) {
  const { identities, ...user } = app.user;
  return {
    ...app,
    user: {
      ...user,
      phoneNumber: identities.find((identity) => identity.phoneNumber)?.phoneNumber ?? null,
      email: identities.find((identity) => identity.email)?.email ?? null,
    },
  };
}

/** At most this many photos of each kind (rejected ones do not count). */
const PHOTO_LIMITS = { GALLERY: 6, CERTIFICATE: 2 } as const;

/** What a technician must provide before submitting, with the label shown when it is missing. */
const REQUIRED_FOR_SUBMIT = [
  ['displayName', 'ho ten'],
  ['idCardFrontKey', 'anh CCCD mat truoc'],
  ['idCardBackKey', 'anh CCCD mat sau'],
  ['faceImageKey', 'anh khuon mat'],
] as const;

@Injectable()
export class TechnicianApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: TechnicianApplicationStorageService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly contracts?: TechnicianContractService,
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
    const { idCardQr, ...fields } = dto;
    const idCard = idCardQr === undefined ? undefined : parseIdCardQr(idCardQr);
    if (idCard === null) throw new BadRequestException('Ma QR CCCD khong hop le, vui long quet lai');
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
    // A switched-off "nơi phục vụ" cannot be newly chosen; ones the technician already had are kept.
    if (dto.supportedModes) {
      const enabled = await readEnabledServiceModes(this.prisma);
      const added = dto.supportedModes.filter((mode) => !current.supportedModes.includes(mode) && !(enabled as string[]).includes(mode));
      if (added.length)
        throw new BadRequestException({ code: 'SERVICE_MODE_DISABLED', message: 'Hinh thuc phuc vu nay dang tam dung', modes: added });
    }
    // Stored as codes ("HN"), whether the app sent the code or the name ("Hà Nội"); unknown values are rejected.
    const location = await resolveLocationCodes(this.prisma, dto.city ?? current.city, dto.district ?? current.district);
    if (modes.includes('ONSITE') && !(dto.facility ?? current.facility)?.trim())
      throw new BadRequestException('Phuc vu tai co so can co thong tin co so');
    if (modes.includes('ONSITE') && !(dto.address ?? current.address)?.trim())
      throw new BadRequestException('Phuc vu tai co so can co dia chi');
    return this.prisma.technicianApplication.update({
      where: { userId },
      data: {
        ...fields,
        // The card is the source of truth for the number; gender only fills in when the app did not send one.
        ...(idCard && {
          idCardInfo: idCard,
          idCardNumber: idCard.idNumber,
          gender: dto.gender ?? current.gender ?? idCard.gender ?? undefined,
        }),
        displayName: dto.displayName?.trim(),
        city: location.city,
        district: location.district,
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
  /**
   * Adds a profile photo or certificate at any time, also after approval. It waits for an admin: with the application
   * while that is under review, on the photo review page once the technician is approved. Customers see approved ones.
   */
  async addGalleryImage(userId: string, storageKey: string, sortOrder = 0, kind: 'GALLERY' | 'CERTIFICATE' = 'GALLERY') {
    if (!storageKey.startsWith(`technician-applications/${userId}/gallery/`))
      throw new BadRequestException('Gallery key khong hop le');
    const app = await this.prisma.technicianApplication.upsert({ where: { userId }, create: { userId }, update: {} });
    const limit = PHOTO_LIMITS[kind];
    const count = await this.prisma.technicianApplicationGalleryImage.count({
      where: { applicationId: app.id, kind, status: { not: 'REJECTED' } },
    });
    if (count >= limit) throw new BadRequestException(`Toi da ${limit} ${kind === 'CERTIFICATE' ? 'anh chung chi' : 'anh ho so'}`);
    const image = await this.prisma.technicianApplicationGalleryImage.create({
      data: { applicationId: app.id, storageKey, sortOrder, kind, status: 'PENDING' },
    });
    if (app.status === 'APPROVED')
      void this.notifications.notifyAdmins?.(
        'ADMIN_TECHNICIAN_PHOTO_PENDING',
        'KTV cập nhật ảnh',
        `${app.displayName ?? 'KTV'} vừa thêm ${kind === 'CERTIFICATE' ? 'chứng chỉ' : 'ảnh hồ sơ'}, cần duyệt.`,
        'admin://technicianPhotos',
      );
    return { ...image, ...(await this.storage.createPrivateViewUrl(storageKey)) };
  }

  /** Photos waiting for (or done with) review, newest first, with who they belong to and a short-lived link. */
  async photoReviews(status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING') {
    const photos = await this.prisma.technicianApplicationGalleryImage.findMany({
      where: { status },
      orderBy: { createdAt: status === 'PENDING' ? 'asc' : 'desc' },
      take: 200,
      include: {
        application: {
          select: { id: true, status: true, displayName: true, user: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
      },
    });
    return Promise.all(
      photos.map(async ({ application, ...photo }) => ({
        ...photo,
        ...(await this.storage.createPrivateViewUrl(photo.storageKey)),
        technician: {
          userId: application.user.id,
          applicationId: application.id,
          applicationStatus: application.status,
          displayName: application.displayName ?? application.user.displayName,
          avatarUrl: application.user.avatarUrl,
        },
      })),
    );
  }

  async reviewPhoto(id: string, status: 'APPROVED' | 'REJECTED', reason?: string) {
    if (status === 'REJECTED' && !reason?.trim()) throw new BadRequestException('Can nhap ly do tu choi anh');
    const photo = await this.prisma.technicianApplicationGalleryImage.findUnique({
      where: { id },
      select: { kind: true, application: { select: { userId: true } } },
    });
    if (!photo) throw new NotFoundException('Anh khong ton tai');
    const updated = await this.prisma.technicianApplicationGalleryImage.update({
      where: { id },
      data: { status, rejectionReason: status === 'REJECTED' ? reason!.trim() : null, reviewedAt: new Date() },
    });
    if (status === 'REJECTED') {
      const what = photo.kind === 'CERTIFICATE' ? 'Chứng chỉ' : 'Ảnh hồ sơ';
      const title = `${what} chưa được duyệt`;
      await this.notifications.create(photo.application.userId, 'TECHNICIAN_PHOTO_REJECTED', title, reason!.trim(), 'matxa://technician/application');
      void this.notifications
        .sendPush?.(photo.application.userId, title, reason!.trim(), { type: 'TECHNICIAN_PHOTO_REJECTED', photoId: id })
        ?.catch(() => undefined);
    }
    return updated;
  }

  /** What customers see on a technician's page: approved profile photos and certificates. */
  async publicPhotos(technicianProfileId: string) {
    const photos = await this.prisma.technicianApplicationGalleryImage.findMany({
      where: { status: 'APPROVED', application: { user: { technicianProfile: { id: technicianProfileId } } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, kind: true, storageKey: true },
    });
    const signed = await Promise.all(
      photos.map(async (photo) => ({ id: photo.id, kind: photo.kind, ...(await this.storage.createPrivateViewUrl(photo.storageKey)) })),
    );
    const strip = ({ kind, ...photo }: (typeof signed)[number]) => photo;
    return {
      gallery: signed.filter((photo) => photo.kind === 'GALLERY').map(strip),
      certificates: signed.filter((photo) => photo.kind === 'CERTIFICATE').map(strip),
    };
  }
  async removeGalleryImage(userId: string, imageId: string) {
    const result = await this.prisma.technicianApplicationGalleryImage.deleteMany({
      where: { id: imageId, application: { userId } },
    });
    if (!result.count) throw new NotFoundException('Anh gallery khong ton tai');
  }
  /** `signature`: the hand-drawn signature uploaded just before, merged into the contract on submit. */
  async submit(
    userId: string,
    signature?: { signatureKey?: string; ip?: string | null; userAgent?: string | null; device?: string | null },
  ) {
    const app = await this.prisma.technicianApplication.findUnique({ where: { userId } });
    if (!app) throw new NotFoundException('Chua co ho so dang ky');
    // Say exactly what is missing; a generic "incomplete" left technicians guessing.
    const missingFields: Array<readonly [string, string]> = REQUIRED_FOR_SUBMIT.filter(([field]) => !String(app[field] ?? '').trim());
    // Customers call their technician, so an account signed in with Google/Apple/email must add a phone first.
    const phone = await this.prisma.userIdentity.findFirst({ where: { userId, phoneNumber: { not: null } }, select: { id: true } });
    if (!phone) missingFields.push(['phoneNumber', 'so dien thoai']);
    if (missingFields.length)
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: `Ho so con thieu: ${missingFields.map(([, label]) => label).join(', ')}`,
        missingFields: missingFields.map(([field]) => field),
      });
    if (app.status === 'APPROVED') throw new ConflictException('Ho so da duoc duyet');
    // Sign before submitting: a broken signature must not leave a submitted application without its contract.
    if (signature?.signatureKey && this.contracts)
      await this.contracts.signApplication(userId, signature.signatureKey, {
        ip: signature.ip ?? null,
        userAgent: signature.userAgent ?? null,
        device: signature.device ?? null,
      });
    const result = await this.prisma.technicianApplication.update({
      where: { userId },
      data: { status: 'SUBMITTED', rejectionReason: null, submittedAt: new Date() },
    });
    await this.prisma.technicianKyc.upsert({
      where: { applicationId: app.id },
      create: { applicationId: app.id, status: 'PENDING_VERIFICATION' },
      update: { status: 'PENDING_VERIFICATION', rejectionReason: null },
    });
    void this.notifications.notifyAdmins?.(
      'ADMIN_APPLICATION_SUBMITTED',
      'Hồ sơ KTV mới chờ duyệt',
      `${app.displayName} vừa nộp hồ sơ đăng ký kỹ thuật viên.`,
      'admin://applications',
    );
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
          user: { select: { ...ADMIN_USER_SELECT } },
          kyc: { select: { status: true } },
          _count: { select: { gallery: true } },
        },
      }),
      this.prisma.technicianApplication.count({ where }),
    ]).then(([items, total]) => ({ items: items.map(withContact), total, page: query.page, limit: query.limit }));
  }
  async detail(id: string) {
    const app = await this.prisma.technicianApplication.findUnique({
      where: { id },
      include: {
        user: { select: { ...ADMIN_USER_SELECT, role: true } },
        gallery: { orderBy: { sortOrder: 'asc' } },
        kyc: { include: { documents: true } },
      },
    });
    if (!app) throw new NotFoundException('Ho so khong ton tai');
    // Older apps stored KYC keys on the application, newer ones as KYC documents; sign both.
    const keys = [
      app.idCardFrontKey,
      app.idCardBackKey,
      app.faceImageKey,
      ...(app.kyc?.documents ?? []).map((document) => document.storageKey),
    ].filter((key): key is string => Boolean(key));
    const signedKyc = await Promise.all(
      [...new Set(keys)].map(async (storageKey) => ({ storageKey, ...(await this.storage.createPrivateViewUrl(storageKey)) })),
    );
    const signedGallery = await Promise.all(
      app.gallery.map(async (image) => ({ ...image, ...(await this.storage.createPrivateViewUrl(image.storageKey)) })),
    );
    const contract = (await this.contracts?.contractForApplication(app.id).catch(() => null)) ?? null;
    return { ...withContact(app), signedKyc, signedGallery, contract };
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
    if (status === 'REJECTED') {
      const type = 'TECHNICIAN_KYC_REJECTED';
      const title = 'KYC cần bổ sung';
      const actionUrl = 'matxa://technician/application';
      await this.notifications.create(
        app.userId,
        type,
        title,
        reason!.trim(),
        actionUrl,
      );
      await this.notifications.sendPush(app.userId, title, reason!.trim(), {
        type,
        applicationId: id,
        actionUrl,
      });
    }
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
    // Applications saved before codes were enforced may still hold a name ("Hà Nội"): publish the code instead.
    const location = await resolveLocationCodes(this.prisma, app.city, app.district).catch(() => ({ city: app.city, district: app.district }));
    const result = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.user.update({ where: { id: app.userId }, data: { role: 'TECHNICIAN' } });
      await tx.technicianProfile.upsert({
        where: { userId: app.userId },
        create: {
          userId: app.userId,
          gender: app.gender,
          bio: app.bio,
          city: location.city,
          district: location.district,
          facility: app.facility,
          address: app.address,
          serviceModes: app.supportedModes.length ? app.supportedModes : ['HOME'],
          isVerified: true,
        },
        update: {
          gender: app.gender,
          bio: app.bio,
          city: location.city,
          district: location.district,
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
      // Photos sent with the application were reviewed with it.
      await tx.technicianApplicationGalleryImage.updateMany({
        where: { applicationId: id, status: 'PENDING' },
        data: { status: 'APPROVED', reviewedAt: now },
      });
      return tx.technicianApplication.update({
        where: { id },
        data: { status: 'APPROVED', reviewedBy: adminId, reviewedAt: now, approvedAt: now, rejectionReason: null },
      });
    });
    await this.contracts?.reviewWithApplication(id, adminId, 'APPROVED');
    const type = 'TECHNICIAN_APPLICATION_APPROVED';
    const title = 'Hồ sơ KTV đã được duyệt';
    const body = 'Bạn đã có thể bắt đầu cấu hình dịch vụ và lịch làm việc.';
    const actionUrl = 'matxa://technician/application';
    await this.notifications.create(
      app.userId,
      type,
      title,
      body,
      actionUrl,
    );
    await this.notifications.sendPush(app.userId, title, body, { type, applicationId: id, actionUrl });
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
    await this.contracts?.reviewWithApplication(id, adminId, 'REJECTED', reason);
    await this.prisma.technicianKyc.updateMany({
      where: { applicationId: id },
      data: { status: 'REJECTED', rejectionReason: reason.trim(), reviewedBy: adminId, reviewedAt: now },
    });
    const type = 'TECHNICIAN_APPLICATION_REJECTED';
    const title = 'Hồ sơ KTV cần bổ sung';
    const body = reason.trim();
    const actionUrl = 'matxa://technician/application';
    await this.notifications.create(
      app.userId,
      type,
      title,
      body,
      actionUrl,
    );
    await this.notifications.sendPush(app.userId, title, body, { type, applicationId: id, actionUrl });
    return result;
  }
}
