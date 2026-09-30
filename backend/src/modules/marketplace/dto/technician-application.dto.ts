import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class UpdateTechnicianApplicationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) displayName?: string;
  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE', 'OTHER'] }) @IsOptional() @IsIn(['MALE', 'FEMALE', 'OTHER']) gender?: 'MALE' | 'FEMALE' | 'OTHER';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) bio?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1024) idCardFrontKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1024) idCardBackKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1024) faceImageKey?: string;
}

export class TechnicianDocumentUploadDto {
  @ApiProperty({ enum: ['ID_CARD_FRONT', 'ID_CARD_BACK', 'FACE'] }) @IsIn(['ID_CARD_FRONT', 'ID_CARD_BACK', 'FACE']) documentType!: 'ID_CARD_FRONT' | 'ID_CARD_BACK' | 'FACE';
  @ApiProperty({ enum: ['image/jpeg', 'image/png', 'image/webp'] }) @IsIn(['image/jpeg', 'image/png', 'image/webp']) contentType!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(10 * 1024 * 1024) size!: number;
}

export class AdminTechnicianApplicationQueryDto {
  @ApiPropertyOptional({ enum: ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED'] }) @IsOptional() @IsIn(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED']) status?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class RejectTechnicianApplicationDto {
  @ApiProperty() @IsString() @MaxLength(1000) reason!: string;
}
