import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class TechnicianContractService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private storage() {
    const bucket = this.config.get<string>('S3_BUCKET');
    const region = this.config.get<string>('S3_REGION');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
    if (!bucket || !region || !accessKeyId || !secretAccessKey) throw new ServiceUnavailableException('S3 chua duoc cau hinh');
    return { bucket, client: new S3Client({ region, credentials: { accessKeyId, secretAccessKey }, endpoint: this.config.get<string>('S3_ENDPOINT') || undefined }) };
  }

  private async ensure(userId: string) {
    const app = await this.prisma.technicianApplication.findUnique({ where: { userId } });
    if (!app || app.status !== 'APPROVED') throw new ConflictException('Ho so KTV chua duoc duyet');
    const identity = await this.prisma.userIdentity.findFirst({ where: { userId, provider: 'PHONE' }, select: { phoneNumber: true } });
    const contract = await this.prisma.technicianContract.upsert({
      where: { userId },
      create: {
        userId, applicationId: app.id, contractNumber: `HD-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
        templateVersion: '2026-01', status: 'DRAFT',
        contractData: { displayName: app.displayName, idCardNumber: app.idCardNumber, phoneNumber: identity?.phoneNumber ?? null, city: app.city, district: app.district, facility: app.facility, address: app.address },
      },
      update: {},
    });
    return contract;
  }

  private mask(value: string | null | undefined) {
    if (!value) return null;
    if (value.length <= 6) return `${value.slice(0, 2)}${'*'.repeat(Math.max(0, value.length - 2))}`;
    return `${value.slice(0, 3)}${'*'.repeat(value.length - 6)}${value.slice(-3)}`;
  }

  async getMine(userId: string) {
    const contract = await this.ensure(userId);
    const data = contract.contractData as Record<string, unknown>;
    return { ...contract, contractData: { ...data, idCardNumber: this.mask(String(data.idCardNumber ?? '')), phoneNumber: this.mask(String(data.phoneNumber ?? '')) } };
  }

  async signatureUploadUrl(userId: string, contentType = 'image/png', size = 0) {
    if (!['image/png', 'image/jpeg'].includes(contentType) || size > 2_000_000) throw new BadRequestException('Chu ky khong hop le');
    const contract = await this.ensure(userId);
    if (contract.status === 'APPROVED') throw new ConflictException('Hop dong da duoc duyet');
    const { bucket, client } = this.storage();
    const storageKey = `technician-contracts/${userId}/signatures/${randomUUID()}.png`;
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: storageKey, ContentType: contentType }), { expiresIn: 600 });
    return { uploadUrl, storageKey, expiresIn: 600 };
  }

  async sign(userId: string, signatureKey: string) {
    const contract = await this.ensure(userId);
    if (!signatureKey.startsWith(`technician-contracts/${userId}/signatures/`)) throw new BadRequestException('Signature key khong hop le');
    if (!['DRAFT', 'REJECTED'].includes(contract.status)) throw new ConflictException('Hop dong khong o trang thai cho ky');
    return this.prisma.technicianContract.update({ where: { id: contract.id }, data: { signatureKey, signedAt: new Date(), status: 'PENDING_REVIEW', rejectionReason: null } });
  }

  async templateUploadUrl(fileName: string, contentType: string) {
    if (contentType !== 'application/pdf') throw new BadRequestException('Mau hop dong phai la PDF');
    const { bucket, client } = this.storage(); const storageKey = `technician-contracts/templates/${randomUUID()}.pdf`;
    return { uploadUrl: await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: storageKey, ContentType: contentType }), { expiresIn: 600 }), storageKey, expiresIn: 600 };
  }
  async uploadTemplateFile(file: any) {
    if (!file?.buffer?.length || file.mimetype !== 'application/pdf') throw new BadRequestException('Mau hop dong phai la PDF');
    const { bucket, client } = this.storage();
    const storageKey = `technician-contracts/templates/${randomUUID()}.pdf`;
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, ContentType: file.mimetype, Body: file.buffer }));
    await this.prisma.contractTemplate.updateMany({ data: { isActive: false } });
    return this.prisma.contractTemplate.create({ data: { storageKey, fileName: file.originalname, contentType: file.mimetype, isActive: true } });
  }
  async setTemplate(storageKey: string, fileName: string, contentType: string) {
    if (!storageKey.startsWith('technician-contracts/templates/')) throw new BadRequestException('Storage key khong hop le');
    await this.prisma.contractTemplate.updateMany({ data: { isActive: false } });
    return this.prisma.contractTemplate.create({ data: { storageKey, fileName, contentType, isActive: true } });
  }
  async templateUrl() {
    const template = await this.prisma.contractTemplate.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
    if (!template) throw new NotFoundException('Chua co mau hop dong'); const { bucket, client } = this.storage();
    return { templateId: template.id, fileName: template.fileName, downloadUrl: await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: template.storageKey }), { expiresIn: 600 }), expiresIn: 600 };
  }
  listAdmin() { return this.prisma.technicianContract.findMany({ orderBy: { createdAt: 'desc' } }); }

  async review(adminId: string, id: string, status: 'APPROVED' | 'REJECTED', reason?: string) {
    const contract = await this.prisma.technicianContract.findUnique({ where: { id } });
    if (!contract) throw new NotFoundException('Hop dong khong ton tai');
    if (contract.status !== 'PENDING_REVIEW') throw new ConflictException('Hop dong chua cho admin duyet');
    if (status === 'REJECTED' && !reason?.trim()) throw new BadRequestException('Can co ly do tu choi');
    let signedDocumentKey = contract.signedDocumentKey;
    if (status === 'APPROVED') {
      const { bucket, client } = this.storage();
      signedDocumentKey = `technician-contracts/${contract.userId}/signed/${contract.contractNumber}.html`;
      const contractData = contract.contractData as Record<string, unknown>;
      const esc = (value: unknown) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] ?? char));
      const html = `<!doctype html><meta charset="utf-8"><title>${esc(contract.contractNumber)}</title><h1>HỢP ĐỒNG DỊCH VỤ</h1><p>Số hợp đồng: ${esc(contract.contractNumber)}</p><p>Họ tên: ${esc(contractData.displayName)}</p><p>Số CCCD: ${esc(contractData.idCardNumber)}</p><p>Số điện thoại: ${esc(contractData.phoneNumber)}</p><p>Khu vực: ${esc(contractData.city)} - ${esc(contractData.district)}</p><hr><p>Phiên bản mẫu: ${esc(contract.templateVersion)}</p><p>Đã ký lúc: ${esc(contract.signedAt?.toISOString())}</p><p>Chữ ký lưu tại: ${esc(contract.signatureKey)}</p>`;
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: signedDocumentKey, ContentType: 'text/html; charset=utf-8', Body: html }));
    }
    return this.prisma.technicianContract.update({ where: { id }, data: { status, signedDocumentKey, reviewedBy: adminId, reviewedAt: new Date(), rejectionReason: status === 'REJECTED' ? reason!.trim() : null } });
  }

  async downloadUrl(id: string) {
    const contract = await this.prisma.technicianContract.findUnique({ where: { id } });
    if (!contract?.signedDocumentKey) throw new NotFoundException('Hop dong chua co ban da duyet');
    const { bucket, client } = this.storage();
    return { downloadUrl: await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: contract.signedDocumentKey }), { expiresIn: 600 }), expiresIn: 600 };
  }
}
