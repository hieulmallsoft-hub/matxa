import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminMutationResponseDto {
  @ApiPropertyOptional() id?: string;
  @ApiPropertyOptional() status?: string;
  @ApiPropertyOptional() message?: string;
  @ApiPropertyOptional() updatedAt?: string;
}
export class AdminDashboardResponseDto {
  @ApiProperty({ type: Object }) counts!: Record<string, number>;
  @ApiPropertyOptional({ type: Object }) recentBookings?: unknown[];
}
export class AdminUserListResponseDto {
  @ApiProperty({ type: [Object] }) items!: unknown[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}
export class AdminBookingListResponseDto extends AdminUserListResponseDto {}
export class AdminTechnicianListResponseDto extends AdminUserListResponseDto {}
export class AdminTechnicianServiceListResponseDto {
  @ApiProperty({ type: [Object] }) services!: unknown[];
}
export class AdminCategoryListResponseDto {
  @ApiProperty({ type: [Object] }) categories!: unknown[];
}
export class AdminBannerListResponseDto {
  @ApiProperty({ type: [Object] }) banners!: unknown[];
}
export class AdminPromotionListResponseDto {
  @ApiProperty({ type: [Object] }) promotions!: unknown[];
}
export class TechnicianApplicationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional() rejectionReason?: string;
  @ApiPropertyOptional({ type: Object }) profile?: Record<string, unknown>;
}
