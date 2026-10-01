import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UpdateTechnicianApplicationDto } from '../dto/technician-application.dto';
import { TechnicianApplicationStorageService } from './technician-application-storage.service';

@Injectable()
export class TechnicianApplicationsService {
  constructor(private readonly prisma: PrismaService, private readonly storage: TechnicianApplicationStorageService) {}
  getMine(userId: string) { return this.prisma.technicianApplication.findUnique({ where: { userId } }); }
  async createMine(userId: string, dto: UpdateTechnicianApplicationDto) {
    const existing = await this.prisma.technicianApplication.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.updateMine(userId, dto);
  }
  async updateMine(userId: string, dto: UpdateTechnicianApplicationDto) {
    if (dto.displayName !== undefined && !dto.displayName.trim()) throw new BadRequestException('Ho ten khong duoc de trong');
    const current = await this.prisma.technicianApplication.upsert({ where: { userId }, create: { userId }, update: {} });
    if (current.status === 'SUBMITTED' || current.status === 'UNDER_REVIEW' || current.status === 'APPROVED') throw new ConflictException('Ho so dang cho duyet hoac da duoc duyet');
    const keys = ['idCardFrontKey', 'idCardBackKey', 'faceImageKey'] as const;
    for (const key of keys) if (dto[key] !== undefined && !dto[key]!.startsWith(`technician-applications/${userId}/`)) throw new BadRequestException('Document key khong hop le');
    return this.prisma.technicianApplication.update({ where: { userId }, data: { ...dto, displayName: dto.displayName?.trim(), city: dto.city?.trim(), district: dto.district?.trim(), facility: dto.facility?.trim(), bio: dto.bio?.trim(), status: 'DRAFT' } });
  }
  uploadUrl(userId: string, dto: Parameters<TechnicianApplicationStorageService['createUploadUrl']>[1]) { return this.storage.createUploadUrl(userId, dto); }
  async submit(userId: string) {
    const app = await this.prisma.technicianApplication.findUnique({ where: { userId } });
    if (!app) throw new NotFoundException('Chua co ho so dang ky');
    if (!app.displayName || !app.idCardFrontKey || !app.idCardBackKey || !app.faceImageKey) throw new BadRequestException('Vui long bo sung du thong tin va anh giay to');
    if (app.status === 'APPROVED') throw new ConflictException('Ho so da duoc duyet');
    return this.prisma.technicianApplication.update({ where: { userId }, data: { status: 'SUBMITTED', rejectionReason: null } });
  }
  list(query: { status?: string; page: number; limit: number }) { const where = query.status ? { status: query.status as any } : {}; return Promise.all([this.prisma.technicianApplication.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } }), this.prisma.technicianApplication.count({ where })]).then(([items, total]) => ({ items, total, page: query.page, limit: query.limit })); }
  async approve(adminId: string, id: string) { const app = await this.prisma.technicianApplication.findUnique({ where: { id } }); if (!app) throw new NotFoundException('Ho so khong ton tai'); if (app.status !== 'SUBMITTED' && app.status !== 'UNDER_REVIEW') throw new ConflictException('Ho so khong o trang thai cho duyet'); return this.prisma.$transaction(async tx => { await tx.user.update({ where: { id: app.userId }, data: { role: 'TECHNICIAN' } }); await tx.technicianProfile.upsert({ where: { userId: app.userId }, create: { userId: app.userId, gender: app.gender, bio: app.bio, city: app.city, district: app.district, facility: app.facility, serviceModes: app.supportedModes.length ? app.supportedModes : ['HOME'], isVerified: true }, update: { gender: app.gender, bio: app.bio, city: app.city, district: app.district, facility: app.facility, serviceModes: app.supportedModes.length ? app.supportedModes : ['HOME'], isVerified: true } }); return tx.technicianApplication.update({ where: { id }, data: { status: 'APPROVED', reviewedBy: adminId, reviewedAt: new Date() } }); }); }
  async reject(adminId: string, id: string, reason: string) { const app = await this.prisma.technicianApplication.findUnique({ where: { id } }); if (!app) throw new NotFoundException('Ho so khong ton tai'); if (app.status !== 'SUBMITTED' && app.status !== 'UNDER_REVIEW') throw new ConflictException('Ho so khong o trang thai cho duyet'); return this.prisma.technicianApplication.update({ where: { id }, data: { status: 'REJECTED', rejectionReason: reason.trim(), reviewedBy: adminId, reviewedAt: new Date() } }); }
}
