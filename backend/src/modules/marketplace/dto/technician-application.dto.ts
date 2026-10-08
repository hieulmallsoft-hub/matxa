import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class UpdateTechnicianApplicationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) displayName?: string;
  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE', 'OTHER'] }) @IsOptional() @IsIn(['MALE', 'FEMALE', 'OTHER']) gender?:
    'MALE' | 'FEMALE' | 'OTHER';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) district?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) facility?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) applicationType?: string;
  @ApiPropertyOptional({ enum: ['HOME', 'ONSITE', 'ONLINE'], isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(['HOME', 'ONSITE', 'ONLINE'], { each: true })
  supportedModes?: Array<'HOME' | 'ONSITE' | 'ONLINE'>;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) bio?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1024) idCardFrontKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1024) idCardBackKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1024) faceImageKey?: string;
}

export class TechnicianDocumentUploadDto {
  @ApiProperty({ enum: ['ID_CARD_FRONT', 'ID_CARD_BACK', 'FACE'] })
  @IsIn(['ID_CARD_FRONT', 'ID_CARD_BACK', 'FACE'])
  documentType!: 'ID_CARD_FRONT' | 'ID_CARD_BACK' | 'FACE';
  @ApiProperty({ enum: ['image/jpeg', 'image/png', 'image/webp'] })
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(10 * 1024 * 1024) size!: number;
}

export class TechnicianGalleryUploadDto {
  @ApiProperty({ enum: ['image/jpeg', 'image/png', 'image/webp'] })
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(10 * 1024 * 1024) size!: number;
}

export class AddTechnicianGalleryImageDto {
  @ApiProperty() @IsString() @MaxLength(1024) storageKey!: string;
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
}

export class AdminTechnicianApplicationQueryDto {
  @ApiPropertyOptional({ enum: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'])
  status?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class RejectTechnicianApplicationDto {
  @ApiProperty() @IsString() @MaxLength(1000) reason!: string;
}

export class ReviewTechnicianKycDto {
  @ApiProperty({ enum: ['VERIFIED', 'REJECTED'] }) @IsIn(['VERIFIED', 'REJECTED']) status!: 'VERIFIED' | 'REJECTED';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}
