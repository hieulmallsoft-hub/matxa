import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookingReviewResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() bookingId!: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) rating!: number;
  @ApiPropertyOptional() comment?: string;
  @ApiProperty() createdAt!: string;
}
export class PaymentCallbackResponseDto {
  @ApiProperty({ example: 'SUCCESS' }) status!: string;
  @ApiPropertyOptional() message?: string;
  @ApiPropertyOptional() orderCode?: string;
}
export class TechnicianJobActionResponseDto {
  @ApiProperty() bookingId!: string;
  @ApiProperty() bookingStatus!: string;
  @ApiPropertyOptional() applicationStatus?: string;
  @ApiPropertyOptional() uploadUrl?: string;
  @ApiPropertyOptional() storageKey?: string;
  @ApiPropertyOptional() expiresAt?: string;
}
