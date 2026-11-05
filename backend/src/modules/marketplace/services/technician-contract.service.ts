import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { buildSignedContractPdf } from './signed-contract-pdf';

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

  // --- Signing while applying: the applicant reads the template, signs by hand, and the signature
  // --- is merged into the template as one PDF before the application goes to the admins.

  /** The active template for someone filling in their application (they are not a technician yet). */
  async applicantTemplate(userId: string) {
    const app = await this.prisma.technicianApplication.findUnique({ where: { userId }, select: { id: true } });
    if (!app) throw new NotFoundException('Chua co ho so dang ky');
    return this.templateUrl();
  }

  async applicantSignatureUploadUrl(userId: string, contentType = 'image/png', size = 0) {
    if (!['image/png', 'image/jpeg'].includes(contentType) || size > 2_000_000) throw new BadRequestException('Chu ky phai la anh PNG/JPEG toi da 2MB');
    const app = await this.prisma.technicianApplication.findUnique({ where: { userId }, select: { status: true } });
    if (!app) throw new NotFoundException('Chua co ho so dang ky');
    if (!['DRAFT', 'REJECTED'].includes(app.status)) throw new ConflictException('Ho so dang cho duyet hoac da duoc duyet');
    const { bucket, client } = this.storage();
    const storageKey = `technician-contracts/${userId}/signatures/${randomUUID()}.${contentType === 'image/jpeg' ? 'jpg' : 'png'}`;
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: storageKey, ContentType: contentType }), { expiresIn: 600 });
    return { uploadUrl, storageKey, expiresIn: 600 };
  }

  /** Records who signed, when and from where, and stores the template + signature page as one PDF. */
  async signApplication(userId: string, signatureKey: string, meta: { ip: string | null; userAgent: string | null; device: string | null }) {
    if (!signatureKey?.startsWith(`technician-contracts/${userId}/signatures/`)) throw new BadRequestException('Chu ky khong hop le');
    const app = await this.prisma.technicianApplication.findUnique({ where: { userId } });
    if (!app) throw new NotFoundException('Chua co ho so dang ky');
    const { bucket, client } = this.storage();
    const signature = await this.readObject(client, bucket, signatureKey).catch(() => {
      throw new BadRequestException('Chua tai anh chu ky len');
    });
    const template = await this.prisma.contractTemplate.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
    const templateBytes = template?.contentType === 'application/pdf' ? (await this.readObject(client, bucket, template.storageKey)).bytes : null;
    const identity = await this.prisma.userIdentity.findFirst({ where: { userId, provider: 'PHONE' }, select: { phoneNumber: true } });
    const existing = await this.prisma.technicianContract.findUnique({ where: { userId }, select: { contractNumber: true } });
    const contractNumber = existing?.contractNumber ?? `HD-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const signedAt = new Date();
    const pdf = await buildSignedContractPdf(templateBytes, signature, {
      contractNumber,
      displayName: app.displayName,
      idCardNumber: app.idCardNumber,
      phoneNumber: identity?.phoneNumber ?? null,
      area: [app.district, app.city].filter(Boolean).join(', ') || null,
      signedAt,
      templateLabel: template ? `${template.fileName} (tải lên ${template.createdAt.toISOString().slice(0, 10)})` : 'Không có mẫu PDF',
      ip: meta.ip,
      device: meta.device ?? meta.userAgent,
    }).catch((error: Error) => {
      throw new BadRequestException(error.message);
    });
    const signedDocumentKey = `technician-contracts/${userId}/signed/${contractNumber}.pdf`;
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: signedDocumentKey, ContentType: 'application/pdf', Body: pdf }));
    const signed = {
      applicationId: app.id,
      templateVersion: template?.id ?? 'NO_TEMPLATE',
      status: 'PENDING_REVIEW' as const,
      contractData: {
        displayName: app.displayName, idCardNumber: app.idCardNumber, phoneNumber: identity?.phoneNumber ?? null,
        city: app.city, district: app.district, facility: app.facility, address: app.address,
        consent: { ip: meta.ip, userAgent: meta.userAgent, device: meta.device, templateId: template?.id ?? null, templateFileName: template?.fileName ?? null },
      },
      signatureKey,
      signedAt,
      signedDocumentKey,
    };
    return this.prisma.technicianContract.upsert({
      where: { userId },
      create: { userId, contractNumber, ...signed },
      update: { ...signed, reviewedBy: null, reviewedAt: null, rejectionReason: null },
    });
  }

  /** What the admin sees on the application: the signature and the signed PDF, both short-lived links. */
  async contractForApplication(applicationId: string) {
    const contract = await this.prisma.technicianContract.findUnique({ where: { applicationId } });
    if (!contract) return null;
    const { bucket, client } = this.storage();
    const link = (key: string | null) =>
      key ? getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 600 }) : Promise.resolve(null);
    return {
      id: contract.id,
      contractNumber: contract.contractNumber,
      status: contract.status,
      signedAt: contract.signedAt,
      consent: (contract.contractData as Record<string, unknown>)?.consent ?? null,
      signatureUrl: await link(contract.signatureKey),
      signedDocumentUrl: await link(contract.signedDocumentKey),
      expiresIn: 600,
    };
  }

  /** Approving or rejecting the application decides the contract signed with it. */
  async reviewWithApplication(applicationId: string, adminId: string, status: 'APPROVED' | 'REJECTED', reason?: string) {
    await this.prisma.technicianContract.updateMany({
      where: { applicationId, status: 'PENDING_REVIEW' },
      data: { status, reviewedBy: adminId, reviewedAt: new Date(), rejectionReason: status === 'REJECTED' ? reason?.trim() || null : null },
    });
  }

  private async readObject(client: S3Client, bucket: string, key: string) {
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = result.Body as { transformToByteArray(): Promise<Uint8Array> } | undefined;
    if (!body) throw new NotFoundException('File khong ton tai');
    return { bytes: await body.transformToByteArray(), contentType: result.ContentType ?? '' };
  }

  async review(adminId: string, id: string, status: 'APPROVED' | 'REJECTED', reason?: string) {
    const contract = await this.prisma.technicianContract.findUnique({ where: { id } });
    if (!contract) throw new NotFoundException('Hop dong khong ton tai');
    if (contract.status !== 'PENDING_REVIEW') throw new ConflictException('Hop dong chua cho admin duyet');
    if (status === 'REJECTED' && !reason?.trim()) throw new BadRequestException('Can co ly do tu choi');
    let signedDocumentKey = contract.signedDocumentKey;
    // Contracts signed while applying already carry the merged PDF; only older ones get the HTML summary.
    if (status === 'APPROVED' && !signedDocumentKey) {
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
