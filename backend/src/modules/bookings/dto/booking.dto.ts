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
  @ApiProperty({ enum: ['CASH'], description: 'Hien chi ho tro thanh toan tien mat' }) @IsIn(['CASH']) paymentMethod!: 'CASH' | 'ONLINE';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
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
  @ApiPropertyOptional({ enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] })
  @IsOptional() @IsIn(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']) status?: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

/** Inbox shown on the KTV Mobile "Nhận việc" tab. */
export class TechnicianJobQueryDto extends BookingHistoryQueryDto {}
