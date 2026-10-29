import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class ComplaintStorageService {
  constructor(private readonly config: ConfigService) {}
  async createUploadUrl(bookingId: string, userId: string, contentType: string, size: number) {
    const { bucket, client } = this.connection();
    const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[contentType];
    if (!ext || size < 1 || size > 10 * 1024 * 1024) throw new BadRequestException('Anh phai la JPEG, PNG hoac WebP, toi da 10 MB');
    const storageKey = `booking-complaint/${bookingId}/${userId}/${randomUUID()}.${ext}`;
    try { return { uploadUrl: await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: storageKey, ContentType: contentType, ContentLength: size }), { expiresIn: 300 }), storageKey, expiresIn: 300 }; }
    finally { client.destroy(); }
  }
  async validateKeys(bookingId: string, userId: string, keys: string[]) {
    if (keys.length > 5 || new Set(keys).size !== keys.length) throw new BadRequestException('EVIDENCE_LIMIT_EXCEEDED');
    const { bucket, client } = this.connection();
    try {
      for (const key of keys) {
        if (!key.startsWith(`booking-complaint/${bookingId}/${userId}/`)) throw new BadRequestException('INVALID_EVIDENCE_KEY');
        try {
          const object = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(object.ContentType ?? '') || !object.ContentLength || object.ContentLength > 10 * 1024 * 1024) throw new BadRequestException('INVALID_EVIDENCE_KEY');
        } catch (error) { if (error instanceof BadRequestException) throw error; throw new BadRequestException('INVALID_EVIDENCE_KEY'); }
      }
    } finally { client.destroy(); }
  }
  private connection() {
    const bucket = this.config.get<string>('S3_BUCKET'); const region = this.config.get<string>('S3_REGION'); const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID'); const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
    if (!bucket || !region || !accessKeyId || !secretAccessKey) throw new ServiceUnavailableException('S3 chua duoc cau hinh');
    const endpoint = this.config.get<string>('S3_ENDPOINT') || undefined;
    return { bucket, client: new S3Client({ region, endpoint, forcePathStyle: Boolean(endpoint), credentials: { accessKeyId, secretAccessKey } }) };
  }
}
