import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export enum CourseAccessDto { FREE = 'FREE', VIP = 'VIP' }
export enum CourseMediaTypeDto { VIDEO = 'VIDEO', IMAGE = 'IMAGE', PDF = 'PDF' }

export class CreateCourseDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(180) title!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(120) slug!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) description?: string;
  @ApiPropertyOptional({ enum: CourseAccessDto }) @IsOptional() @IsEnum(CourseAccessDto) access?: CourseAccessDto;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublished?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
export class UpdateCourseDto extends CreateCourseDto {}
export class CreateLessonDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(180) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) description?: string;
  @ApiPropertyOptional({ enum: CourseAccessDto }) @IsOptional() @IsEnum(CourseAccessDto) access?: CourseAccessDto;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) durationSeconds?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
export class UpdateLessonDto extends CreateLessonDto {}
export class CreateMediaUploadUrlDto {
  @ApiProperty({ enum: CourseMediaTypeDto }) @IsEnum(CourseMediaTypeDto) type!: CourseMediaTypeDto;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(180) fileName!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(180) contentType!: string;
}
export class CreateMediaDto {
  @ApiProperty({ enum: CourseMediaTypeDto }) @IsEnum(CourseMediaTypeDto) type!: CourseMediaTypeDto;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(180) storageKey!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(180) contentType!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(180) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) fileSize?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
