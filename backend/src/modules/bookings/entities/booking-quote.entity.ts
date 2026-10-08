import { ApiProperty } from '@nestjs/swagger';

export class BookingAddressSnapshot {
  @ApiProperty() id!: string;
  @ApiProperty() addressText!: string;
  @ApiProperty({ description: 'Alias retained for address rendering' }) address!: string;
  @ApiProperty() latitude!: number;
  @ApiProperty() longitude!: number;
  @ApiProperty({ type: String, nullable: true }) label!: string | null;
}

export class QuotedService {
  @ApiProperty() id!: string;
  @ApiProperty() serviceId!: string;
  @ApiProperty() technicianServiceId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() durationMinutes!: number;
  @ApiProperty({ type: String, nullable: true }) priceOptionId!: string | null;
  @ApiProperty({ type: String, nullable: true }) priceOptionCode!: string | null;
  @ApiProperty() price!: number;
}

export class QuotePromotionResponse {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() discount!: number;
}

export class BookingQuoteResponse {
  @ApiProperty() technicianId!: string;
  @ApiProperty({ type: [String], description: 'TechnicianService IDs selected by the customer' })
  technicianServiceIds!: string[];
  @ApiProperty({ type: [QuotedService] }) services!: QuotedService[];
  @ApiProperty({ enum: ['HOME', 'ONSITE', 'ONLINE'] }) mode!: string;
  @ApiProperty() serviceMode!: string;
  @ApiProperty() scheduledStart!: Date;
  @ApiProperty() scheduledEnd!: Date;
  @ApiProperty() startAt!: Date;
  @ApiProperty() endAt!: Date;
  @ApiProperty() durationMinutes!: number;
  @ApiProperty() totalDuration!: number;
  @ApiProperty() totalDurationMinutes!: number;
  @ApiProperty() subtotal!: number;
  @ApiProperty() serviceFee!: number;
  @ApiProperty({ description: 'Alias of serviceFee for the HOME service fee' }) homeServiceFee!: number;
  @ApiProperty({ type: String, nullable: true }) promotionId!: string | null;
  @ApiProperty({ type: String, nullable: true }) promotionCode!: string | null;
  @ApiProperty() discountAmount!: number;
  @ApiProperty({ description: 'Alias of discountAmount' }) discount!: number;
  @ApiProperty({ type: QuotePromotionResponse, nullable: true }) promotion!: QuotePromotionResponse | null;
  @ApiProperty() totalAmount!: number;
  @ApiProperty({ description: 'Alias of totalAmount' }) total!: number;
  @ApiProperty({ type: BookingAddressSnapshot, nullable: true }) addressSnapshot!: BookingAddressSnapshot | null;
}
