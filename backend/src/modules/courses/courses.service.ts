import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../../database/prisma.service';
import { CreateCourseDto, CreateCoverUploadUrlDto, CreateLessonDto, CreateMediaDto, CreateMediaUploadUrlDto, UpdateCourseDto, UpdateLessonDto } from './dto/course.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}
  private storage() {
    const bucket = this.config.get<string>('S3_BUCKET'); const region = this.config.get<string>('S3_REGION');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID'); const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
    if (!bucket || !region || !accessKeyId || !secretAccessKey) throw new ServiceUnavailableException('S3 chưa được cấu hình');
    return { bucket, client: new S3Client({ region, credentials: { accessKeyId, secretAccessKey }, endpoint: this.config.get<string>('S3_ENDPOINT') || undefined }) };
  }
  async listPublic() { return this.prisma.course.findMany({ where: { isPublished: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }], include: { lessons: { orderBy: { sortOrder: 'asc' }, select: { id: true, title: true, access: true, durationSeconds: true, sortOrder: true, media: { orderBy: { sortOrder: 'asc' }, select: { id: true, type: true, title: true, contentType: true, sortOrder: true } } } } } }); }
  listAdmin() { return this.prisma.course.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }], include: { lessons: { orderBy: { sortOrder: 'asc' }, include: { media: { orderBy: { sortOrder: 'asc' } } } } } }); }
  async get(id: string) { const course = await this.prisma.course.findUnique({ where: { id }, include: { lessons: { orderBy: { sortOrder: 'asc' }, include: { media: { orderBy: { sortOrder: 'asc' } } } } } }); if (!course) throw new NotFoundException('Không tìm thấy khóa học'); return course; }
  create(dto: CreateCourseDto) { return this.prisma.course.create({ data: { ...dto, access: dto.access ?? 'FREE' }, include: { lessons: true } }); }
  async update(id: string, dto: UpdateCourseDto) { await this.get(id); return this.prisma.course.update({ where: { id }, data: dto }); }
  async coverUploadUrl(courseId: string, dto: CreateCoverUploadUrlDto) { await this.get(courseId); const { bucket, client } = this.storage(); const ext = dto.fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'; const storageKey = `courses/${courseId}/cover/${randomUUID()}.${ext}`; const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: storageKey, ContentType: dto.contentType }), { expiresIn: 600 }); return { uploadUrl, storageKey, expiresIn: 600 }; }
  async setCover(id: string, coverKey: string) { await this.get(id); if (!coverKey.startsWith(`courses/${id}/cover/`)) throw new BadRequestException('Ảnh bìa không thuộc khóa học'); return this.prisma.course.update({ where: { id }, data: { coverKey } }); }
  async remove(id: string) { await this.get(id); return this.prisma.course.update({ where: { id }, data: { isPublished: false } }); }
  async createLesson(courseId: string, dto: CreateLessonDto) { await this.get(courseId); return this.prisma.courseLesson.create({ data: { ...dto, courseId, access: dto.access ?? 'FREE' }, include: { media: true } }); }
  async updateLesson(id: string, dto: UpdateLessonDto) { const lesson = await this.prisma.courseLesson.findUnique({ where: { id } }); if (!lesson) throw new NotFoundException('Không tìm thấy bài học'); return this.prisma.courseLesson.update({ where: { id }, data: dto }); }
  async removeLesson(id: string) { const lesson = await this.prisma.courseLesson.findUnique({ where: { id } }); if (!lesson) throw new NotFoundException('Không tìm thấy bài học'); await this.prisma.courseLesson.delete({ where: { id } }); }
  async uploadUrl(lessonId: string, dto: CreateMediaUploadUrlDto) { const lesson = await this.prisma.courseLesson.findUnique({ where: { id: lessonId } }); if (!lesson) throw new NotFoundException('Không tìm thấy bài học'); const { bucket, client } = this.storage(); const ext = dto.fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'; const storageKey = `courses/${lesson.courseId}/${lessonId}/${randomUUID()}.${ext}`; const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: storageKey, ContentType: dto.contentType }), { expiresIn: 600 }); return { uploadUrl, storageKey, expiresIn: 600 }; }
  async createMedia(lessonId: string, dto: CreateMediaDto) { const lesson = await this.prisma.courseLesson.findUnique({ where: { id: lessonId } }); if (!lesson) throw new NotFoundException('Không tìm thấy bài học'); if (!dto.storageKey.startsWith(`courses/${lesson.courseId}/${lessonId}/`)) throw new BadRequestException('Storage key không thuộc bài học'); return this.prisma.courseMedia.create({ data: { ...dto, lessonId } }); }
  async mediaUrl(id: string) { const media = await this.prisma.courseMedia.findUnique({ where: { id } }); if (!media) throw new NotFoundException('Không tìm thấy media'); const { bucket, client } = this.storage(); return { mediaUrl: await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: media.storageKey }), { expiresIn: 300 }), expiresIn: 300 }; }
}
