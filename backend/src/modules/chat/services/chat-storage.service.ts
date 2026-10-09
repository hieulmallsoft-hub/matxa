import { randomUUID } from 'crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CreateUploadUrlDto } from '../dto/chat.dto';

@Injectable()
export class ChatStorageService {
  constructor(private readonly config: ConfigService) {}

  async createUploadUrl(conversationId: string, userId: string, dto: CreateUploadUrlDto) {
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
    const mediaKey = `chat/${conversationId}/${userId}/${randomUUID()}.${extension}`;
    // An empty S3_ENDPOINT means AWS S3's regional endpoint. Passing an empty
    // string to the SDK makes presigned chat-image URLs invalid.
    const endpoint = this.config.get<string>('S3_ENDPOINT') || undefined;
    const client = new S3Client({
      region,
      endpoint,
      forcePathStyle: Boolean(endpoint),
      credentials: { accessKeyId, secretAccessKey },
    });
    const expiresIn = 300;
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: mediaKey,
        ContentType: dto.contentType,
        ContentLength: dto.size,
      }),
      { expiresIn },
    );
    const mediaUrl = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: mediaKey }), { expiresIn });
    return { uploadUrl, mediaUrl, mediaKey, expiresIn };
  }

  async createReadUrl(mediaKey: string) {
    const bucket = this.config.get<string>('S3_BUCKET');
    const region = this.config.get<string>('S3_REGION');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      throw new ServiceUnavailableException('S3 chua duoc cau hinh');
    }
    const endpoint = this.config.get<string>('S3_ENDPOINT') || undefined;
    const client = new S3Client({
      region,
      endpoint,
      forcePathStyle: Boolean(endpoint),
      credentials: { accessKeyId, secretAccessKey },
    });
    return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: mediaKey }), { expiresIn: 300 });
  }
}
