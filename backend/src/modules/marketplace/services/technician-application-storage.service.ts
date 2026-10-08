import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class TechnicianApplicationStorageService {
  constructor(private readonly config: ConfigService) {}
  async createUploadUrl(userId: string, dto: { documentType: string; contentType: string; size: number }) {
    const bucket = this.config.get<string>('S3_BUCKET');
    const region = this.config.get<string>('S3_REGION');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
    if (!bucket || !region || !accessKeyId || !secretAccessKey)
      throw new ServiceUnavailableException('S3 chua duoc cau hinh');
    const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[
      dto.contentType
    ];
    const key = `technician-applications/${userId}/${dto.documentType.toLowerCase()}/${randomUUID()}.${ext}`;
    const client = new S3Client({
      region,
      endpoint: this.config.get<string>('S3_ENDPOINT') || undefined,
      credentials: { accessKeyId, secretAccessKey },
    });
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: dto.contentType, ContentLength: dto.size }),
      { expiresIn: 300 },
    );
    client.destroy();
    return { uploadUrl, mediaKey: key, expiresIn: 300 };
  }

  createGalleryUploadUrl(userId: string, dto: { contentType: string; size: number }) {
    return this.createUploadUrl(userId, { ...dto, documentType: 'GALLERY' });
  }

  async createPrivateViewUrl(storageKey: string) {
    if (!storageKey.startsWith('technician-applications/'))
      throw new ServiceUnavailableException('KYC storage key khong hop le');
    const bucket = this.config.get<string>('S3_BUCKET');
    const region = this.config.get<string>('S3_REGION');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
    if (!bucket || !region || !accessKeyId || !secretAccessKey)
      throw new ServiceUnavailableException('S3 chua duoc cau hinh');
    const client = new S3Client({
      region,
      endpoint: this.config.get<string>('S3_ENDPOINT') || undefined,
      credentials: { accessKeyId, secretAccessKey },
    });
    const viewUrl = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: storageKey }), {
      expiresIn: 300,
    });
    client.destroy();
    return { viewUrl, expiresIn: 300 };
  }
}
