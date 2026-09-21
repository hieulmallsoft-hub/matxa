import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TechnicianListItem {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiPropertyOptional() displayName?: string;
  @ApiPropertyOptional() avatarUrl?: string;
  @ApiProperty() averageRating!: number;
  @ApiProperty() reviewCount!: number;
  @ApiProperty() isAvailable!: boolean;
  @ApiPropertyOptional() distanceKm?: number;
  @ApiProperty({ type: [String] }) tags!: string[];
}

export class TechnicianListResponse {
  @ApiProperty({ type: [TechnicianListItem] }) items!: TechnicianListItem[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}
