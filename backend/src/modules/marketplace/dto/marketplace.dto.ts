import { ApiProperty, ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, Matches } from 'class-validator';

export class SearchTechniciansDto {
  @ApiPropertyOptional({ enum: ['recommended', 'distance', 'rating', 'availability'], default: 'recommended', description: 'distance requires latitude and longitude; recommended uses distance when provided, otherwise availability then rating' })
  @IsOptional() @IsIn(['recommended', 'distance', 'rating', 'availability']) sort?: 'recommended' | 'distance' | 'rating' | 'availability';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) search?: string;
  @ApiPropertyOptional({ description: 'Alias of search; search takes precedence' }) @IsOptional() @IsString() @MaxLength(100) keyword?: string;
  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE', 'OTHER'] }) @IsOptional() @IsIn(['MALE', 'FEMALE', 'OTHER']) gender?: 'MALE' | 'FEMALE' | 'OTHER';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) tag?: string;
  @ApiPropertyOptional({ type: [String], description: 'Comma-separated or repeated tags; matches all tags' })
  @IsOptional() @Transform(({ value }) => {
    const tags = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : value;
    return Array.isArray(tags) ? tags.map((tag) => typeof tag === 'string' ? tag.trim() : tag) : tags;
  })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @IsString({ each: true }) @MinLength(1, { each: true }) @MaxLength(50, { each: true }) tags?: string[];
  @ApiPropertyOptional({ enum: ['HOME', 'ONSITE', 'ONLINE'] }) @IsOptional() @IsIn(['HOME', 'ONSITE', 'ONLINE']) mode?: 'HOME' | 'ONSITE' | 'ONLINE';
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional({ description: 'TechnicianService ID, not category ID' }) @IsOptional() @IsUUID() serviceId?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value) @IsBoolean() available?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLatitude() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLongitude() longitude?: number;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class MarketplaceHomeQueryDto extends PickType(SearchTechniciansDto, ['latitude', 'longitude'] as const) {}

export class AvailabilityQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01', description: 'Local date in Asia/Ho_Chi_Minh; exclusive with from/to' })
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) date?: string;
  @ApiPropertyOptional({ description: 'ISO timestamp with Z or timezone offset; inclusive' })
  @IsOptional() @IsDateString({ strict: true }) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i) from?: string;
  @ApiPropertyOptional({ description: 'ISO timestamp with timezone; exclusive, max 31-day range' })
  @IsOptional() @IsDateString({ strict: true }) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i) to?: string;
  @ApiPropertyOptional({ type: [String], description: 'TechnicianService IDs, comma-separated or repeated. Required for computed slots.' })
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.split(',').map((id) => id.trim()) : value)
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsUUID('4', { each: true }) serviceIds?: string[];
  @ApiPropertyOptional({ enum: ['HOME', 'ONSITE', 'ONLINE'] })
  @IsOptional() @IsIn(['HOME', 'ONSITE', 'ONLINE']) mode?: 'HOME' | 'ONSITE' | 'ONLINE';
  @ApiPropertyOptional({ default: 30, minimum: 5, maximum: 120, description: 'Grid anchored to working interval start' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(120) stepMinutes = 30;
}

export class UpsertTechnicianProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) bio?: string;
  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE', 'OTHER'] }) @IsOptional() @IsIn(['MALE', 'FEMALE', 'OTHER']) gender?: 'MALE' | 'FEMALE' | 'OTHER';
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) tags?: string[];
  @ApiProperty({ enum: ['HOME', 'ONSITE', 'ONLINE'], isArray: true }) @IsArray() @ArrayMinSize(1) @IsIn(['HOME', 'ONSITE', 'ONLINE'], { each: true }) serviceModes!: ('HOME' | 'ONSITE' | 'ONLINE')[];
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLatitude() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLongitude() longitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) address?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Boolean) @IsBoolean() isAvailable?: boolean;
}

export class CreateTechnicianServiceDto {
  @ApiProperty() @IsUUID() categoryId!: string;
  @ApiProperty() @IsString() @MaxLength(150) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(15) @Max(720) durationMinutes!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) price!: number;
  @ApiProperty({ enum: ['HOME', 'ONSITE', 'ONLINE'], isArray: true }) @IsArray() @ArrayMinSize(1) @IsIn(['HOME', 'ONSITE', 'ONLINE'], { each: true }) modes!: ('HOME' | 'ONSITE' | 'ONLINE')[];
}

export class UpdateTechnicianServiceDto extends PartialType(CreateTechnicianServiceDto) {
  @ApiPropertyOptional() @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
}

export class CreateAvailabilityDto {
  @ApiProperty() @IsDateString() startAt!: string;
  @ApiProperty() @IsDateString() endAt!: string;
}

export class CreateAddressDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) label?: string;
  @ApiProperty() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(500) address!: string;
  @ApiProperty() @Type(() => Number) @IsLatitude() latitude!: number;
  @ApiProperty() @Type(() => Number) @IsLongitude() longitude!: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}

export class CreateCategoryDto {
  @ApiProperty() @IsString() @MaxLength(100) name!: string;
  @ApiProperty() @IsString() @MaxLength(100) slug!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) iconUrl?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
}

export class CreateBannerDto {
  @ApiProperty() @IsString() @MaxLength(150) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) subtitle?: string;
  @ApiProperty() @IsString() @MaxLength(1000) imageUrl!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) actionUrl?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endsAt?: string;
}

export class CreatePromotionDto {
  @ApiProperty() @IsString() @MaxLength(50) code!: string;
  @ApiProperty() @IsString() @MaxLength(150) name!: string;
  @ApiProperty({ enum: ['PERCENT', 'FIXED'] }) @IsIn(['PERCENT', 'FIXED']) type!: 'PERCENT' | 'FIXED';
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) value!: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minOrderAmount?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxDiscount?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) usageLimit?: number;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) perUserLimit?: number;
  @ApiProperty() @IsDateString() startsAt!: string;
  @ApiProperty() @IsDateString() endsAt!: string;
}

export class CreateTechnicianByAdminDto extends UpsertTechnicianProfileDto {
  @ApiProperty() @IsUUID() userId!: string;
  @ApiPropertyOptional({ description: 'Admin-only Marketplace visibility; defaults to true for new profiles' })
  @IsOptional() @IsBoolean() isActive?: boolean;
}
