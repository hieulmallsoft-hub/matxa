import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

export type VenueImageFile = { buffer: Buffer; mimetype: string; size: number };

/** A venue image this service uploaded: `venues/<uuid>.<ext>` anywhere in the URL, with or without a signature. */
const OWN_IMAGE = /\/(venues\/[0-9a-f-]{36}\.(?:jpg|png|webp))(?:[?#]|$)/i;
/** Long enough that a list the app keeps open for the day still shows its images. */
const VIEW_SECONDS = 24 * 3600;

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
    return { url: `${this.base()}/${storageKey}` };
  }

  /**
   * The bucket is private (only avatars are public), so an uploaded venue image is shown through a signed link.
   * Image URLs from elsewhere are returned as they are.
   */
  async viewUrl(url: string) {
    const key = OWN_IMAGE.exec(url)?.[1];
    const bucket = this.config.get<string>('S3_BUCKET');
    const region = this.config.get<string>('S3_REGION');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
    if (!key || !bucket || !region || !accessKeyId || !secretAccessKey) return url;
    const endpoint = this.config.get<string>('S3_ENDPOINT') || undefined;
    this.signer ??= new S3Client({ region, endpoint, forcePathStyle: Boolean(endpoint), credentials: { accessKeyId, secretAccessKey } });
    return getSignedUrl(this.signer, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: VIEW_SECONDS });
  }

  /** The admin form sends back the signed links it was shown; store the plain URL instead. */
  storedUrl(url: string) {
    const key = OWN_IMAGE.exec(url)?.[1];
    return key && this.config.get<string>('S3_BUCKET') ? `${this.base()}/${key}` : url;
  }

  private signer?: S3Client;

  private base() {
    const bucket = this.config.get<string>('S3_BUCKET');
    const region = this.config.get<string>('S3_REGION');
    const endpoint = this.config.get<string>('S3_ENDPOINT') || undefined;
    return (
      this.config.get<string>('S3_PUBLIC_BASE_URL')?.replace(/\/$/, '') ||
      (endpoint ? `${endpoint.replace(/\/$/, '')}/${bucket}` : `https://${bucket}.s3.${region}.amazonaws.com`)
    );
  }
}
