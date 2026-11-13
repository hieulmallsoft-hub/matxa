import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../../database/prisma.service';
import { CreateCourseDto, CreateCoverUploadUrlDto, CreateLessonDto, CreateMediaDto, CreateMediaUploadUrlDto, UpdateCourseDto, UpdateLessonDto, UpdateMediaDto } from './dto/course.dto';

/** Multipart file names arrive as UTF-8 bytes read as Latin-1 (mojibake); read them back as UTF-8. */
export function decodeFileName(name: string) {
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('�') ? name : decoded;
}
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}
  async uploadMedia(lessonId: string, file: any, type: string) {
    const lesson = await this.prisma.courseLesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Không tìm thấy bài học');
    if (!file?.buffer?.length) throw new BadRequestException('Chưa chọn file media');
    if (!['VIDEO', 'IMAGE', 'PDF'].includes(type)) throw new BadRequestException('Loại media không hợp lệ');
    const ext = file.originalname.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const storageKey = `courses/${lesson.courseId}/${lessonId}/${randomUUID()}.${ext}`;
    const { bucket, client } = this.storage();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: file.buffer, ContentType: file.mimetype }));
    return this.prisma.courseMedia.create({ data: { lessonId, type: type as any, storageKey, contentType: file.mimetype, title: decodeFileName(file.originalname), fileSize: file.size } });
  }
  /** Rename a file (or move it in the list). */
  async updateMedia(id: string, dto: UpdateMediaDto) {
    const media = await this.prisma.courseMedia.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('Không tìm thấy media');
    return this.prisma.courseMedia.update({
      where: { id },
      data: { ...(dto.title !== undefined ? { title: dto.title.trim() } : {}), ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}) },
    });
  }
  /** Lesson illustration, uploaded through the API like the course cover. Replaces the previous one. */
  async uploadLessonThumbnail(lessonId: string, file: any) {
    const lesson = await this.prisma.courseLesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Không tìm thấy bài học');
    if (!file?.buffer?.length) throw new BadRequestException('Chưa chọn ảnh minh họa');
    const ext = IMAGE_TYPES[file.mimetype as string];
    if (!ext) throw new BadRequestException('Ảnh minh họa phải là JPG, PNG hoặc WEBP');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('Ảnh minh họa tối đa 5MB');
    const storageKey = `courses/${lesson.courseId}/${lessonId}/thumbnail/${randomUUID()}.${ext}`;
    const { bucket, client } = this.storage();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: file.buffer, ContentType: file.mimetype }));
    await this.prisma.courseLesson.update({ where: { id: lessonId }, data: { thumbnailKey: storageKey } });
    if (lesson.thumbnailKey) client.send(new DeleteObjectCommand({ Bucket: bucket, Key: lesson.thumbnailKey })).catch(() => undefined);
    return this.get(lesson.courseId);
  }
  async removeLessonThumbnail(lessonId: string) {
    const lesson = await this.prisma.courseLesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Không tìm thấy bài học');
    await this.prisma.courseLesson.update({ where: { id: lessonId }, data: { thumbnailKey: null } });
    if (lesson.thumbnailKey) {
      const { bucket, client } = this.storage();
      client.send(new DeleteObjectCommand({ Bucket: bucket, Key: lesson.thumbnailKey })).catch(() => undefined);
    }
    return this.get(lesson.courseId);
  }
  async removeMedia(id: string) {
    const media = await this.prisma.courseMedia.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('Không tìm thấy media');
    const { bucket, client } = this.storage();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: media.storageKey }));
    await this.prisma.courseMedia.delete({ where: { id } });
  }
  private storage() {
    const bucket = this.config.get<string>('S3_BUCKET'); const region = this.config.get<string>('S3_REGION');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID'); const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
    if (!bucket || !region || !accessKeyId || !secretAccessKey) throw new ServiceUnavailableException('S3 chưa được cấu hình');
    return { bucket, client: new S3Client({ region, credentials: { accessKeyId, secretAccessKey }, endpoint: this.config.get<string>('S3_ENDPOINT') || undefined }) };
  }
  /** Admin uploads the cover through the API (the bucket has no CORS, so the browser cannot PUT to S3 itself). */
  async uploadCover(courseId: string, file: any) {
    const course = await this.get(courseId);
    if (!file?.buffer?.length) throw new BadRequestException('Chưa chọn ảnh bìa');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) throw new BadRequestException('Ảnh bìa phải là JPG, PNG hoặc WEBP');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('Ảnh bìa tối đa 5MB');
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.mimetype as string];
    const storageKey = `courses/${courseId}/cover/${randomUUID()}.${ext}`;
    const { bucket, client } = this.storage();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: file.buffer, ContentType: file.mimetype }));
    await this.prisma.course.update({ where: { id: courseId }, data: { coverKey: storageKey } });
    // The old cover is no longer referenced; removing it is best-effort.
    if (course.coverKey) client.send(new DeleteObjectCommand({ Bucket: bucket, Key: course.coverKey })).catch(() => undefined);
    return this.get(courseId);
  }
  /** Private bucket: every course response carries a signed `coverUrl` (24h) the web and app can show directly. */
  private async withCoverUrl<T extends { coverKey?: string | null; lessons?: Array<{ thumbnailKey?: string | null }> }>(course: T): Promise<T & { coverUrl: string | null }> {
    // Each lesson gets a signed `thumbnailUrl` the same way.
    const lessons = course.lessons
      ? await Promise.all(course.lessons.map(async (lesson) => ({ ...lesson, thumbnailUrl: await this.signed(lesson.thumbnailKey) })))
      : undefined;
    return { ...course, ...(lessons ? { lessons } : {}), coverUrl: await this.signed(course.coverKey) };
  }
  private async signed(key?: string | null) {
    if (!key) return null;
    try {
      const { bucket, client } = this.storage();
      return await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 86_400 });
    } catch {
      return null;
    }
  }
  async listPublic() { return this.listPublicRaw().then((courses) => Promise.all(courses.map((course) => this.withCoverUrl(course)))); }
  private listPublicRaw() { return this.prisma.course.findMany({ where: { isPublished: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }], include: { lessons: { orderBy: { sortOrder: 'asc' }, select: { id: true, title: true, description: true, access: true, durationSeconds: true, thumbnailKey: true, sortOrder: true, media: { orderBy: { sortOrder: 'asc' }, select: { id: true, type: true, title: true, contentType: true, sortOrder: true } } } } } }); }
  async listAdmin() { return this.listAdminRaw().then((courses) => Promise.all(courses.map((course) => this.withCoverUrl(course)))); }
  private listAdminRaw() { return this.prisma.course.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }], include: { lessons: { orderBy: { sortOrder: 'asc' }, include: { media: { orderBy: { sortOrder: 'asc' } } } } } }); }
  async get(id: string) { const course = await this.prisma.course.findUnique({ where: { id }, include: { lessons: { orderBy: { sortOrder: 'asc' }, include: { media: { orderBy: { sortOrder: 'asc' } } } } } }); if (!course) throw new NotFoundException('Không tìm thấy khóa học'); return this.withCoverUrl(course); }
  async create(dto: CreateCourseDto) { try { return await this.prisma.course.create({ data: { ...dto, access: dto.access ?? 'FREE', isPublished: dto.isPublished ?? true }, include: { lessons: true } }); } catch (error: any) { if (error?.code === 'P2002') throw new ConflictException('Slug khóa học đã tồn tại'); throw error; } }
  async update(id: string, dto: UpdateCourseDto) { await this.get(id); return this.prisma.course.update({ where: { id }, data: dto }); }
  async coverUploadUrl(courseId: string, dto: CreateCoverUploadUrlDto) { await this.get(courseId); const { bucket, client } = this.storage(); const ext = dto.fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'; const storageKey = `courses/${courseId}/cover/${randomUUID()}.${ext}`; const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: storageKey, ContentType: dto.contentType }), { expiresIn: 600 }); return { uploadUrl, storageKey, expiresIn: 600 }; }
  async setCover(id: string, coverKey: string) { await this.get(id); if (!coverKey.startsWith(`courses/${id}/cover/`)) throw new BadRequestException('Ảnh bìa không thuộc khóa học'); return this.prisma.course.update({ where: { id }, data: { coverKey } }); }
  async remove(id: string) { await this.get(id); return this.prisma.course.delete({ where: { id } }); }
  async createLesson(courseId: string, dto: CreateLessonDto) { await this.get(courseId); return this.prisma.courseLesson.create({ data: { ...dto, courseId, access: dto.access ?? 'FREE' }, include: { media: true } }); }
  async updateLesson(id: string, dto: UpdateLessonDto) { const lesson = await this.prisma.courseLesson.findUnique({ where: { id } }); if (!lesson) throw new NotFoundException('Không tìm thấy bài học'); return this.prisma.courseLesson.update({ where: { id }, data: dto }); }
  async removeLesson(id: string) {
    const lesson = await this.prisma.courseLesson.findUnique({ where: { id }, include: { media: { select: { storageKey: true } } } });
    if (!lesson) throw new NotFoundException('Không tìm thấy bài học');
    await this.prisma.courseLesson.delete({ where: { id } });
    // Its files are no longer referenced; removing them is best-effort.
    const keys = [...(lesson.media ?? []).map((media) => media.storageKey), ...(lesson.thumbnailKey ? [lesson.thumbnailKey] : [])];
    if (!keys.length) return;
    try {
      const { bucket, client } = this.storage();
      for (const key of keys) client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
    } catch {
      // Storage not configured: the rows are gone either way.
    }
  }
  async uploadUrl(lessonId: string, dto: CreateMediaUploadUrlDto) { const lesson = await this.prisma.courseLesson.findUnique({ where: { id: lessonId } }); if (!lesson) throw new NotFoundException('Không tìm thấy bài học'); const { bucket, client } = this.storage(); const ext = dto.fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'; const storageKey = `courses/${lesson.courseId}/${lessonId}/${randomUUID()}.${ext}`; const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: storageKey, ContentType: dto.contentType }), { expiresIn: 600 }); return { uploadUrl, storageKey, expiresIn: 600 }; }
  async createMedia(lessonId: string, dto: CreateMediaDto) { const lesson = await this.prisma.courseLesson.findUnique({ where: { id: lessonId } }); if (!lesson) throw new NotFoundException('Không tìm thấy bài học'); if (!dto.storageKey.startsWith(`courses/${lesson.courseId}/${lessonId}/`)) throw new BadRequestException('Storage key không thuộc bài học'); return this.prisma.courseMedia.create({ data: { ...dto, lessonId } }); }
  async mediaUrl(id: string) { const media = await this.prisma.courseMedia.findUnique({ where: { id } }); if (!media) throw new NotFoundException('Không tìm thấy media'); const { bucket, client } = this.storage(); return { mediaUrl: await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: media.storageKey }), { expiresIn: 300 }), expiresIn: 300 }; }
}
