import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

export type VenueImageFile = { buffer: Buffer; mimetype: string; size: number };

@Injectable()
export class VenueStorageService {
  constructor(private readonly config: ConfigService) {}

  async upload(file: VenueImageFile) {
    const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    const extension = file && extensions[file.mimetype];
    if (!extension || !file.buffer?.length || file.buffer.length > 5 * 1024 * 1024)
      throw new BadRequestException('Chọn ảnh JPEG, PNG hoặc WebP, tối đa 5 MB');
    const signature = file.buffer;
    const valid =
      file.mimetype === 'image/jpeg'
        ? signature.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
        : file.mimetype === 'image/png'
          ? signature.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : signature.subarray(0, 4).toString() === 'RIFF' && signature.subarray(8, 12).toString() === 'WEBP';
    if (!valid) throw new BadRequestException('Nội dung file không đúng định dạng ảnh');
    const bucket = this.config.get<string>('S3_BUCKET');
    const region = this.config.get<string>('S3_REGION');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
    if (!bucket || !region || !accessKeyId || !secretAccessKey)
      throw new ServiceUnavailableException('Chưa cấu hình S3 để lưu ảnh địa điểm. Bạn có thể dùng URL ảnh.');
    const endpoint = this.config.get<string>('S3_ENDPOINT') || undefined;
    const client = new S3Client({
      region,
      endpoint,
      forcePathStyle: Boolean(endpoint),
      credentials: { accessKeyId, secretAccessKey },
      maxAttempts: 2,
    });
    const storageKey = `venues/${randomUUID()}.${extension}`;
    try {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: file.buffer, ContentType: file.mimetype }),
      );
    } catch {
      throw new ServiceUnavailableException('Không tải được ảnh lên kho lưu trữ. Vui lòng thử lại hoặc dùng URL ảnh.');
    } finally {
      client.destroy();
    }
    const base =
      this.config.get<string>('S3_PUBLIC_BASE_URL')?.replace(/\/$/, '') ||
      (endpoint ? `${endpoint.replace(/\/$/, '')}/${bucket}` : `https://${bucket}.s3.${region}.amazonaws.com`);
    return { url: `${base}/${storageKey}` };
  }
}
