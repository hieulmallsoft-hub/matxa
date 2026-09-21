import { randomUUID } from 'crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CreateAvatarUploadUrlDto } from '../dto/profile.dto';

@Injectable()
export class ProfileStorageService {
  constructor(private readonly config: ConfigService) {}

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
