import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, Matches } from 'class-validator';

export class QuoteBookingDto {
  @ApiProperty() @IsUUID() technicianId!: string;
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsUUID('4', { each: true }) serviceIds!: string[];
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
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class UpdateBookingStatusDto {
  @ApiProperty({ enum: ['CONFIRMED', 'COMPLETED'] }) @IsIn(['CONFIRMED', 'COMPLETED']) status!: 'CONFIRMED' | 'COMPLETED';
}

export class CreateReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) rating!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}
