import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CreateAvatarUploadUrlDto } from '../dto/profile.dto';

@Injectable()
export class ProfileStorageService {
  private readonly logger = new Logger(ProfileStorageService.name);
  constructor(private readonly config: ConfigService) {}

  private connection() {
    const bucket = this.config.get<string>('S3_BUCKET');
    const region = this.config.get<string>('S3_REGION');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      throw new ServiceUnavailableException('S3 chua duoc cau hinh');
    }
    const endpoint = this.config.get<string>('S3_ENDPOINT') || undefined;
    return { bucket, client: new S3Client({ region, endpoint, forcePathStyle: Boolean(endpoint),
      credentials: { accessKeyId, secretAccessKey }, maxAttempts: 2 }) };
  }

  // A separate stored key prevents an upload URL from overwriting a saved avatar.
  async prepareAvatar(userId: string, key: string): Promise<string> {
    const { bucket, client } = this.connection();
    try {
      const object = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      const types: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
      const extension = types[object.ContentType ?? ''];
      if (!extension || !object.ContentLength || object.ContentLength > 5 * 1024 * 1024) {
        throw new BadRequestException('Anh phai la JPEG, PNG hoac WebP, toi da 5 MB');
      }
      const savedKey = `avatars/${userId}/saved/${randomUUID()}.${extension}`;
      await client.send(new CopyObjectCommand({ Bucket: bucket, Key: savedKey,
        CopySource: `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`,
        CopySourceIfMatch: object.ETag,
      }));
      return savedKey;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404 || status === 412) throw new BadRequestException('Anh chua upload hoac da thay doi, vui long upload lai');
      throw new ServiceUnavailableException('Khong the kiem tra va luu anh tren S3');
    } finally { client.destroy(); }
  }

  async deleteAvatar(userId: string, key: string | null | undefined): Promise<void> {
    if (!key?.startsWith(`avatars/${userId}/`)) return;
    try {
      const { bucket, client } = this.connection();
      try { await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })); }
      finally { client.destroy(); }
    } catch {
      // Cleanup failure must not turn a committed profile update into an error.
      this.logger.warn('Khong the don anh cu tren S3; can kiem tra quyen DeleteObject');
    }
  }

  async createAvatarUploadUrl(userId: string, dto: CreateAvatarUploadUrlDto) {
    const bucket = this.config.get<string>('S3_BUCKET');
    const region = this.config.get<string>('S3_REGION');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      throw new ServiceUnavailableException('S3 chua duoc cau hinh');
    }

    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[dto.contentType];
    const mediaKey = `avatars/${userId}/${randomUUID()}.${extension}`;
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const client = new S3Client({
      region,
      endpoint,
      forcePathStyle: Boolean(endpoint),
      credentials: { accessKeyId, secretAccessKey },
    });
    const expiresIn = 300;
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({
      Bucket: bucket,
      Key: mediaKey,
      ContentType: dto.contentType,
      ContentLength: dto.size,
    }), { expiresIn });
    const publicBaseUrl = this.config.get<string>('S3_PUBLIC_BASE_URL')?.replace(/\/$/, '');
    const mediaUrl = publicBaseUrl
      ? `${publicBaseUrl}/${mediaKey}`
      : `https://${bucket}.s3.${region}.amazonaws.com/${mediaKey}`;
    return { uploadUrl, mediaUrl, mediaKey, expiresIn };
  }

  publicUrlFor(mediaKey: string): string {
    const bucket = this.config.getOrThrow<string>('S3_BUCKET');
    const region = this.config.getOrThrow<string>('S3_REGION');
    const publicBaseUrl = this.config.get<string>('S3_PUBLIC_BASE_URL')?.replace(/\/$/, '');
    return publicBaseUrl
      ? `${publicBaseUrl}/${mediaKey}`
      : `https://${bucket}.s3.${region}.amazonaws.com/${mediaKey}`;
  }
}
