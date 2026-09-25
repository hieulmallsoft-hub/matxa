import { ApiProperty } from '@nestjs/swagger';

export class TechnicianListItem {
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'TechnicianProfile ID; alias of id' }) technicianId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ type: String, nullable: true }) displayName!: string | null;
  @ApiProperty({ type: String, nullable: true }) avatarUrl!: string | null;
  @ApiProperty() averageRating!: number;
  @ApiProperty({ description: 'Alias of averageRating' }) rating!: number;
  @ApiProperty({ type: [String], enum: ['HOME', 'ONSITE', 'ONLINE'], description: 'Modes supported by profile and matching active services' }) supportedModes!: string[];
  @ApiProperty({ type: String, nullable: true, description: 'Currently null: select services and use availability for bookable start times' }) nextAvailableAt!: string | null;
  @ApiProperty() reviewCount!: number;
  @ApiProperty() isAvailable!: boolean;
  @ApiProperty({ type: Number, nullable: true }) distanceKm!: number | null;
  @ApiProperty({ type: [String] }) tags!: string[];
  @ApiProperty({ enum: ['MALE', 'FEMALE', 'OTHER'], nullable: true }) gender!: string | null;
  @ApiProperty({ type: [String], enum: ['HOME', 'ONSITE', 'ONLINE'] }) serviceModes!: string[];
  @ApiProperty() isVerified!: boolean;
  @ApiProperty() isFavorite!: boolean;
  @ApiProperty({ type: String, nullable: true }) city!: string | null;
  @ApiProperty({ type: Number, nullable: true, description: 'Lowest matching active service price' }) startingPrice!: number | null;
}

export class TechnicianListResponse {
  @ApiProperty({ type: [TechnicianListItem] }) items!: TechnicianListItem[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export class MarketplaceCategoryResponse {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ type: String, nullable: true }) iconUrl!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class MarketplaceBannerResponse {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: String, nullable: true }) subtitle!: string | null;
  @ApiProperty() imageUrl!: string;
  @ApiProperty({ type: String, nullable: true }) actionUrl!: string | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ type: Date, nullable: true }) startsAt!: Date | null;
  @ApiProperty({ type: Date, nullable: true }) endsAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class MarketplaceHomeResponse {
  @ApiProperty({ type: [MarketplaceBannerResponse] }) banners!: MarketplaceBannerResponse[];
  @ApiProperty({ type: [MarketplaceCategoryResponse] }) categories!: MarketplaceCategoryResponse[];
  @ApiProperty({ type: [TechnicianListItem] }) technicians!: TechnicianListItem[];
}

export class PublicTechnicianUser {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, nullable: true }) displayName!: string | null;
  @ApiProperty({ type: String, nullable: true }) avatarUrl!: string | null;
}

export class TechnicianServiceResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'Legacy alias of technicianServiceId; no master service entity exists. Use in booking serviceIds.' }) serviceId!: string;
  @ApiProperty() technicianServiceId!: string;
  @ApiProperty() technicianId!: string;
  @ApiProperty() categoryId!: string;
  @ApiProperty() categoryName!: string;
  @ApiProperty({ type: [String], enum: ['HOME', 'ONSITE', 'ONLINE'] }) supportedModes!: string[];
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty() price!: number;
  @ApiProperty() durationMinutes!: number;
  @ApiProperty({ type: [String], enum: ['HOME', 'ONSITE', 'ONLINE'] }) modes!: string[];
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ type: MarketplaceCategoryResponse }) category!: MarketplaceCategoryResponse;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class TechnicianReviewResponse {
  @ApiProperty() id!: string;
  @ApiProperty() bookingId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() technicianId!: string;
  @ApiProperty() rating!: number;
  @ApiProperty({ type: String, nullable: true }) comment!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty({ type: PublicTechnicianUser }) user!: PublicTechnicianUser;
}

export class OnsiteLocationResponse {
  @ApiProperty({ type: String, nullable: true }) address!: string | null;
  @ApiProperty({ type: String, nullable: true }) city!: string | null;
  @ApiProperty({ type: Number, nullable: true }) latitude!: number | null;
  @ApiProperty({ type: Number, nullable: true }) longitude!: number | null;
}

export class TechnicianDetailResponse extends TechnicianListItem {
  @ApiProperty({ type: [String], enum: ['HOME', 'ONSITE', 'ONLINE'], description: 'Union of all active service modes in active categories' }) declare supportedModes: string[];
  @ApiProperty({ type: PublicTechnicianUser }) user!: PublicTechnicianUser;
  @ApiProperty({ type: String, nullable: true }) bio!: string | null;
  @ApiProperty({ type: String, nullable: true }) address!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Legacy Decimal serialization; onsiteLocation has numeric coordinates' }) latitude!: string | null;
  @ApiProperty({ type: String, nullable: true }) longitude!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty({ type: [String], description: 'Current schema only provides the avatar; empty if none' }) images!: string[];
  @ApiProperty({ type: OnsiteLocationResponse, nullable: true }) onsiteLocation!: OnsiteLocationResponse | null;
  @ApiProperty({ type: [TechnicianServiceResponse] }) services!: TechnicianServiceResponse[];
  @ApiProperty({ type: [TechnicianReviewResponse] }) reviews!: TechnicianReviewResponse[];
}

export class AvailabilitySlotResponse {
  @ApiProperty() startAt!: Date;
  @ApiProperty() endAt!: Date;
}

export class ComputedAvailabilityResponse {
  @ApiProperty() technicianId!: string;
  @ApiProperty({ type: String, nullable: true, example: '2026-09-25' }) date!: string | null;
  @ApiProperty({ type: [String] }) serviceIds!: string[];
  @ApiProperty({ type: [String], description: 'Preferred booking-compatible TechnicianService IDs; alias of serviceIds' }) technicianServiceIds!: string[];
  @ApiProperty({ enum: ['HOME', 'ONSITE', 'ONLINE'] }) mode!: string;
  @ApiProperty({ example: 'Asia/Ho_Chi_Minh' }) timezone!: string;
  @ApiProperty() from!: Date;
  @ApiProperty() to!: Date;
  @ApiProperty() durationMinutes!: number;
  @ApiProperty({ description: 'Alias of durationMinutes for availability UI' }) totalDurationMinutes!: number;
  @ApiProperty() stepMinutes!: number;
  @ApiProperty({ type: [AvailabilitySlotResponse] }) slots!: AvailabilitySlotResponse[];
}

export class WorkingScheduleResponse extends AvailabilitySlotResponse {
  @ApiProperty() id!: string;
  @ApiProperty() technicianId!: string;
  @ApiProperty() isAvailable!: boolean;
  @ApiProperty() createdAt!: Date;
}
