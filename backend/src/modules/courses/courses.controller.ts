import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateCourseDto, CreateLessonDto, CreateMediaDto, CreateMediaUploadUrlDto, UpdateCourseDto, UpdateLessonDto } from './dto/course.dto';
import { CoursesService } from './courses.service';

@ApiTags('Courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}
  @Get() list() { return this.courses.listPublic(); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string) { return this.courses.get(id); }
  @Get('media/:id/url') mediaUrl(@Param('id', ParseUUIDPipe) id: string) { return this.courses.mediaUrl(id); }
}

@ApiTags('Admin Courses')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/courses')
export class AdminCoursesController {
  constructor(private readonly courses: CoursesService) {}
  @Get() list() { return this.courses.listAdmin(); }
  @Post() create(@Body() dto: CreateCourseDto) { return this.courses.create(dto); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string) { return this.courses.get(id); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCourseDto) { return this.courses.update(id, dto); }
  @Delete(':id') remove(@Param('id', ParseUUIDPipe) id: string) { return this.courses.remove(id); }
  @Post(':id/lessons') lesson(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateLessonDto) { return this.courses.createLesson(id, dto); }
  @Patch('lessons/:id') updateLesson(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLessonDto) { return this.courses.updateLesson(id, dto); }
  @Delete('lessons/:id') removeLesson(@Param('id', ParseUUIDPipe) id: string) { return this.courses.removeLesson(id); }
  @Post('lessons/:id/media-upload-url') uploadUrl(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateMediaUploadUrlDto) { return this.courses.uploadUrl(id, dto); }
  @Post('lessons/:id/media') createMedia(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateMediaDto) { return this.courses.createMedia(id, dto); }
}
