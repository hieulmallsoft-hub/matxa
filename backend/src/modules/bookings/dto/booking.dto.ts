import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, Matches } from 'class-validator';

export class QuoteBookingDto {
  @ApiProperty() @IsUUID() technicianId!: string;
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsUUID('4', { each: true }) serviceIds!: string[];
  @ApiPropertyOptional({ type: [String], description: 'Price option IDs in the same order as serviceIds. Required for services that use price options.' }) @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsUUID('4', { each: true }) priceOptionIds?: string[];
  @ApiProperty({ enum: ['HOME', 'ONSITE', 'ONLINE'] }) @IsIn(['HOME', 'ONSITE', 'ONLINE']) mode!: 'HOME' | 'ONSITE' | 'ONLINE';
  @ApiProperty({ description: 'ISO timestamp with explicit Z or timezone offset' }) @IsDateString({ strict: true }) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i) scheduledStart!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() addressId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) promotionCode?: string;
}

export class CreateBookingDto extends QuoteBookingDto {
  @ApiProperty({ enum: ['CASH', 'ONLINE'], description: 'ONLINE su dung VNPAY khi server da duoc cau hinh' }) @IsIn(['CASH', 'ONLINE']) paymentMethod!: 'CASH' | 'ONLINE';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class OpenBookingItemDto {
  @ApiProperty() @IsUUID() catalogServiceId!: string;
  @ApiProperty() @IsUUID() priceOptionId!: string;
}

/** Customer request for a platform-catalog service; no technician is selected yet. */
export class CreateOpenBookingDto {
  @ApiProperty({ type: [OpenBookingItemDto] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) items!: OpenBookingItemDto[];
  @ApiProperty({ enum: ['HOME', 'ONSITE', 'ONLINE'] }) @IsIn(['HOME', 'ONSITE', 'ONLINE']) mode!: 'HOME' | 'ONSITE' | 'ONLINE';
  @ApiProperty({ example: 'HN', description: 'Ma thanh pho theo location master' }) @IsString() @MaxLength(50) city!: string;
  @ApiPropertyOptional({ example: 'HN-CAU-GIAY' }) @IsOptional() @IsString() @MaxLength(50) district?: string;
  @ApiProperty({ description: 'ISO timestamp with explicit Z or timezone offset' }) @IsDateString({ strict: true }) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i) scheduledStart!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() addressId?: string;
  @ApiPropertyOptional({ description: 'Optional ISO deadline. It must be before scheduledStart.' }) @IsOptional() @IsDateString({ strict: true }) applicationDeadlineAt?: string;
  @ApiProperty({ enum: ['CASH'] }) @IsIn(['CASH']) paymentMethod!: 'CASH';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class SelectTechnicianDto {
  @ApiProperty() @IsUUID() applicationId!: string;
}

export class CancelBookingDto {
  @ApiPropertyOptional({ enum: ['NO_LONGER_NEEDED', 'SERVICE_ISSUE', 'PAYMENT_REFUND_ISSUE', 'OTHER'] })
  @IsOptional() @IsIn(['NO_LONGER_NEEDED', 'SERVICE_ISSUE', 'PAYMENT_REFUND_ISSUE', 'OTHER']) reasonCode?: 'NO_LONGER_NEEDED' | 'SERVICE_ISSUE' | 'PAYMENT_REFUND_ISSUE' | 'OTHER';
  @ApiPropertyOptional({ description: 'Bắt buộc khi reasonCode=OTHER' }) @IsOptional() @IsString() @MaxLength(500) reasonText?: string;
  /** Legacy alias retained for existing Mobile clients. */
  @ApiPropertyOptional({ deprecated: true }) @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class UpdateBookingStatusDto {
  @ApiProperty({ enum: ['CONFIRMED', 'COMPLETED'] }) @IsIn(['CONFIRMED', 'COMPLETED']) status!: 'CONFIRMED' | 'COMPLETED';
}

export class CreateReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) rating!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  comment?: string;
}

export class BookingHistoryQueryDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] })
  @IsOptional() @IsIn(['OPEN', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']) status?: string;
  @ApiPropertyOptional({ default: 1, type: Number, description: 'Trang bắt đầu từ 1' }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ default: 20, type: Number, maximum: 100, description: 'Số bản ghi mỗi trang' }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

/** Inbox shown on the KTV Mobile "Nhận việc" tab. */
export class TechnicianJobQueryDto extends BookingHistoryQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) district?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() serviceId?: string;
}
