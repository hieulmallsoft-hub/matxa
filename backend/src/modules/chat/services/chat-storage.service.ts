import { randomUUID } from 'crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CreateUploadUrlDto } from '../dto/chat.dto';

@Injectable()
export class ChatStorageService {
  constructor(private readonly config: ConfigService) {}

  async createUploadUrl(conversationId: string, dto: CreateUploadUrlDto) {
    const bucket = this.config.get<string>('S3_BUCKET');
    const region = this.config.get<string>('S3_REGION');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      throw new ServiceUnavailableException('S3 chua duoc cau hinh');
    }

    const extensionByType: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const extension = extensionByType[dto.contentType];
    const mediaKey = `chat/${conversationId}/${randomUUID()}.${extension}`;
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
}
