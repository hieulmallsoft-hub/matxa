import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MarketplaceCategoryListResponseDto {
  @ApiProperty({ type: [Object] }) categories!: unknown[];
}
export class LocationListResponseDto {
  @ApiProperty({ type: [Object] }) locations!: unknown[];
}
export class FavoriteResponseDto {
  @ApiProperty() technicianId!: string;
  @ApiProperty() isFavorite!: boolean;
}
export class UploadResponseDto {
  @ApiProperty() uploadUrl!: string;
  @ApiProperty() storageKey!: string;
  @ApiProperty() expiresIn!: number;
}
export class TechnicianServiceResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string;
  @ApiPropertyOptional() isActive?: boolean;
}
export class AvailabilityResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() startAt!: string;
  @ApiProperty() endAt!: string;
  @ApiPropertyOptional() status?: string;
}
export class AddressResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() label!: string;
  @ApiProperty() addressLine!: string;
  @ApiPropertyOptional() latitude?: number;
  @ApiPropertyOptional() longitude?: number;
  @ApiPropertyOptional() isDefault?: boolean;
}
