import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';

export const LEGAL_AUDIENCES = ['CUSTOMER', 'TECHNICIAN', 'ALL'] as const;
export type LegalAudience = (typeof LEGAL_AUDIENCES)[number];
/** Policy PDFs are often long, scanned documents. */
export const MAX_PDF_BYTES = 30_000_000;

type LegalRow = {
  code: string; title: string; audience: string; version: number; storageKey: string; fileName: string;
  sortOrder: number; isActive: boolean; createdAt: Date;
};

const summary = (row: LegalRow) => ({
  code: row.code,
  title: row.title,
  audience: row.audience,
  version: row.version,
  versionLabel: `${row.version}.0`,
  fileName: row.fileName,
  updatedAt: row.createdAt,
});

/** "Dieu khoan dich vu" -> DIEU_KHOAN_DICH_VU, so a new document gets a stable code from its title. */
const codeFromTitle = (title: string) =>
  title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);

/** Terms and policies the admin uploads as PDFs; every upload of a code is its next version. */
@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  /** Current version of each document the given audience should see (documents for everyone included). */
  async list(audience?: LegalAudience) {
    const rows: LegalRow[] = await this.prisma.legalDocument.findMany({
      where: { isActive: true, ...(audience && audience !== 'ALL' ? { audience: { in: [audience, 'ALL'] } } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }, { version: 'desc' }],
    });
    const seen = new Set<string>();
    return rows.filter((row) => !seen.has(row.code) && seen.add(row.code)).map(summary);
  }

  async get(code: string) {
    const row: LegalRow | null = await this.prisma.legalDocument.findFirst({
      where: { code, isActive: true },
      orderBy: { version: 'desc' },
    });
    if (!row) throw new NotFoundException('Van ban khong ton tai');
    return { ...summary(row), downloadUrl: await this.downloadUrl(row.storageKey), expiresIn: 600 };
  }

  /** Every document with its current version on top of its history, for the admin page. */
  async adminList() {
    const rows: LegalRow[] = await this.prisma.legalDocument.findMany({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }, { version: 'desc' }] });
    const byCode = new Map<string, LegalRow[]>();
    for (const row of rows) byCode.set(row.code, [...(byCode.get(row.code) ?? []), row]);
    return Promise.all(
      [...byCode.values()].map(async (versions) => {
        const current = versions.find((row) => row.isActive) ?? null;
        return {
          code: versions[0].code,
          title: (current ?? versions[0]).title,
          audience: (current ?? versions[0]).audience,
          published: Boolean(current),
          current: current ? { ...summary(current), downloadUrl: await this.downloadUrl(current.storageKey) } : null,
          history: versions.map((row) => ({ version: row.version, versionLabel: `${row.version}.0`, fileName: row.fileName, createdAt: row.createdAt })),
        };
      }),
    );
  }

  async upload(
    adminId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined,
    dto: { code?: string; title: string; audience: string; sortOrder?: number },
  ) {
    if (!file?.buffer?.length || file.mimetype !== 'application/pdf') throw new BadRequestException('Van ban phai la file PDF');
    if (file.size > MAX_PDF_BYTES) throw new BadRequestException(`File PDF toi da ${MAX_PDF_BYTES / 1_000_000}MB`);
    const title = dto.title?.trim();
    if (!title) throw new BadRequestException('Vui long nhap ten van ban');
    if (!LEGAL_AUDIENCES.includes(dto.audience as LegalAudience)) throw new BadRequestException('Doi tuong phai la CUSTOMER, TECHNICIAN hoac ALL');
    const code = codeFromTitle(dto.code?.trim() || title);
    if (!code) throw new BadRequestException('Ma van ban khong hop le');

    const latest = await this.prisma.legalDocument.findFirst({ where: { code }, orderBy: { version: 'desc' } });
    const version = (latest?.version ?? 0) + 1;
    const storageKey = `legal-documents/${code}/v${version}-${randomUUID()}.pdf`;
    const { bucket, client } = this.storage();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, ContentType: 'application/pdf', Body: file.buffer }));
    return this.prisma.$transaction(async (tx) => {
      await tx.legalDocument.updateMany({ where: { code }, data: { isActive: false } });
      return tx.legalDocument.create({
        data: {
          code, title, audience: dto.audience, version, storageKey, fileName: file.originalname,
          sortOrder: dto.sortOrder ?? latest?.sortOrder ?? 0, createdBy: adminId,
        },
      });
    });
  }

  /** Takes a document off the apps; uploading it again publishes the next version. */
  async hide(code: string) {
    const result = await this.prisma.legalDocument.updateMany({ where: { code }, data: { isActive: false } });
    if (!result.count) throw new NotFoundException('Van ban khong ton tai');
    return { code, published: false };
  }

  private downloadUrl(storageKey: string) {
    const { bucket, client } = this.storage();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: storageKey }), { expiresIn: 600 });
  }

  private storage() {
    const bucket = this.config.get<string>('S3_BUCKET');
    const region = this.config.get<string>('S3_REGION');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
    if (!bucket || !region || !accessKeyId || !secretAccessKey) throw new ServiceUnavailableException('S3 chua duoc cau hinh');
    return {
      bucket,
      client: new S3Client({ region, credentials: { accessKeyId, secretAccessKey }, endpoint: this.config.get<string>('S3_ENDPOINT') || undefined }),
    };
  }
}
