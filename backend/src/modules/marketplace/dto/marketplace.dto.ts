import { ApiProperty, ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ServicePriceRange } from './service-price';

export class SearchTechniciansDto {
  @ApiPropertyOptional({
    description:
      'Thoi diem bat dau muon dat (ISO timestamp). Khi gui ca hai moc, chi tra KTV co slot bao phu ca khung gio.',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  availableFrom?: string;
  @ApiPropertyOptional({ description: 'Thoi diem ket thuc muon dat (ISO timestamp)' })
  @IsOptional()
  @IsDateString({ strict: true })
  availableTo?: string;
  @ApiPropertyOptional({
    minimum: 0.1,
    maximum: 100,
    default: 25,
    description: 'Ban kinh toi da (km) tu vi tri khach hang',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(100)
  radiusKm?: number;
  @ApiPropertyOptional({
    enum: ['recommended', 'distance', 'rating', 'availability'],
    default: 'recommended',
    description:
      'distance requires latitude and longitude; recommended uses distance when provided, otherwise availability then rating',
  })
  @IsOptional()
  @IsIn(['recommended', 'distance', 'rating', 'availability'])
  sort?: 'recommended' | 'distance' | 'rating' | 'availability';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) search?: string;
  @ApiPropertyOptional({ description: 'Alias of search; search takes precedence' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;
  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE', 'OTHER'] }) @IsOptional() @IsIn(['MALE', 'FEMALE', 'OTHER']) gender?:
    'MALE' | 'FEMALE' | 'OTHER';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) tag?: string;
  @ApiPropertyOptional({ type: [String], description: 'Comma-separated or repeated tags; matches all tags' })
  @IsOptional()
  @Transform(({ value }) => {
    const tags = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : value;
    return Array.isArray(tags) ? tags.map((tag) => (typeof tag === 'string' ? tag.trim() : tag)) : tags;
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(50, { each: true })
  tags?: string[];
  @ApiPropertyOptional({ enum: ['HOME', 'ONSITE', 'ONLINE'] }) @IsOptional() @IsIn(['HOME', 'ONSITE', 'ONLINE']) mode?:
    'HOME' | 'ONSITE' | 'ONLINE';
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional({ description: 'TechnicianService ID, not category ID' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  available?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLatitude() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLongitude() longitude?: number;
  @ApiPropertyOptional({ example: 'HN', description: 'Ma thanh pho (locations/cities). Chi tra KTV o thanh pho nay' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  city?: string;
  @ApiPropertyOptional({
    example: '2026-11-05',
    description: 'Ngay (gio Viet Nam) de tinh nextAvailableAt cua tung KTV. Mac dinh hom nay.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date?: string;
  @ApiPropertyOptional({ description: 'true = bo KTV het cho trong ngay `date` (nextAvailableAt = null)' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  onlyAvailable?: boolean;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class MarketplaceHomeQueryDto extends PickType(SearchTechniciansDto, ['latitude', 'longitude'] as const) {}

export class AvailabilityQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01', description: 'Local date in Asia/Ho_Chi_Minh; exclusive with from/to' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date?: string;
  @ApiPropertyOptional({ description: 'ISO timestamp with Z or timezone offset; inclusive' })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i)
  from?: string;
  @ApiPropertyOptional({ description: 'ISO timestamp with timezone; exclusive, max 31-day range' })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i)
  to?: string;
  @ApiPropertyOptional({
    type: [String],
    description: 'TechnicianService IDs, comma-separated or repeated. Required for computed slots.',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').map((id) => id.trim()) : value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  serviceIds?: string[];
  @ApiPropertyOptional({
    type: [String],
    description:
      'Preferred alias of serviceIds. These are TechnicianService IDs used by booking. Do not send both fields.',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').map((id) => id.trim()) : value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  technicianServiceIds?: string[];
  @ApiPropertyOptional({
    type: [String],
    description: 'Price option IDs in the same order as serviceIds/technicianServiceIds.',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').map((id) => id.trim()) : value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  priceOptionIds?: string[];
  @ApiPropertyOptional({ enum: ['HOME', 'ONSITE', 'ONLINE'] })
  @IsOptional()
  @IsIn(['HOME', 'ONSITE', 'ONLINE'])
  mode?: 'HOME' | 'ONSITE' | 'ONLINE';
  @ApiPropertyOptional({
    default: 30,
    minimum: 5,
    maximum: 120,
    description: 'Grid anchored to working interval start',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(120)
  stepMinutes = 30;
}

export class UpsertTechnicianProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) bio?: string;
  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE', 'OTHER'] }) @IsOptional() @IsIn(['MALE', 'FEMALE', 'OTHER']) gender?:
    'MALE' | 'FEMALE' | 'OTHER';
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];
  @ApiProperty({ enum: ['HOME', 'ONSITE', 'ONLINE'], isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(['HOME', 'ONSITE', 'ONLINE'], { each: true })
  serviceModes!: ('HOME' | 'ONSITE' | 'ONLINE')[];
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLatitude() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLongitude() longitude?: number;
  @ApiPropertyOptional({ example: 'HN', description: 'Ma tinh/thanh (GET /locations/cities)' })
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @ApiPropertyOptional({
    example: 'HN-PHUONG-CAU-GIAY',
    description: 'Ma phuong/xa thuoc tinh da chon (GET /locations/cities/{code}/districts). Chuoi rong = bo chon. Doi city ma khong gui district thi phuong/xa cu bi xoa.',
  })
  @IsOptional() @IsString() @MaxLength(100) district?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) address?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Boolean) @IsBoolean() isAvailable?: boolean;
}

export class CreateTechnicianServiceDto {
  @ApiProperty({ description: 'ID dịch vụ do Admin tạo trong service catalog' })
  @IsUUID()
  catalogServiceId!: string;

  @ApiProperty({ enum: ['HOME', 'ONSITE', 'ONLINE'], isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsIn(['HOME', 'ONSITE', 'ONLINE'], { each: true })
  modes!: ('HOME' | 'ONSITE' | 'ONLINE')[];
}

export class UpdateTechnicianServiceDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional({ enum: ['HOME', 'ONSITE', 'ONLINE'], isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsIn(['HOME', 'ONSITE', 'ONLINE'], { each: true })
  modes?: ('HOME' | 'ONSITE' | 'ONLINE')[];
}

export class CreateTechnicianServicePriceOptionDto {
  @ApiProperty({ example: '90_MINUTES', description: 'Stable code unique within one technician service' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code!: string;
  @ApiProperty({ example: 90 }) @Type(() => Number) @IsInt() @Min(15) @Max(720) durationMinutes!: number;
  @ApiProperty({ example: 350000 }) @Type(() => Number) @IsNumber() @Min(0) price!: number;
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
}

/** KTV may change the price and activation state of an existing catalog option. */
export class UpdateTechnicianServicePriceOptionDto {
  @ApiPropertyOptional({ example: 450000, description: 'Giá mới, đơn vị VND (400.000 – 1.000.000)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ServicePriceRange()
  price?: number;

  @ApiPropertyOptional({ description: 'Hiển thị gói này cho khách đặt lịch' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

export class CreateAvailabilityDto {
  @ApiProperty() @IsDateString() startAt!: string;
  @ApiProperty() @IsDateString() endAt!: string;
}

export class CreateAddressDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) label?: string;
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  address!: string;
  @ApiProperty() @Type(() => Number) @IsLatitude() latitude!: number;
  @ApiProperty() @Type(() => Number) @IsLongitude() longitude!: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '0901234567',
    description: 'So dien thoai lien he tai dia chi nay (KTV goi so nay). Bo trong/null = dung so cua tai khoan',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\s.\-]/g, '') || null : value))
  @IsOptional()
  @Matches(/^\+?[0-9]{8,15}$/, { message: 'So dien thoai khong hop le' })
  phone?: string | null;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}

export class CreateCategoryDto {
  @ApiProperty() @IsString() @MaxLength(100) name!: string;
  @ApiProperty() @IsString() @MaxLength(100) slug!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) iconUrl?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @ApiPropertyOptional({ description: 'Bat = huy don da co KTV nhan cua danh muc nay bi tinh vao gioi han huy (mac dinh bat).' })
  @IsOptional() @IsBoolean() countsCancellations?: boolean;
}

/** Who cancelled many taken bookings lately, for the admin to review. */
export class CancelOffendersQueryDto {
  @ApiPropertyOptional({ example: 7, description: 'So ngay gan nhat' }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(90) days?: number;
  @ApiPropertyOptional({ example: 3, description: 'Chi lay nguoi huy tu so lan nay tro len' }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) minCancellations?: number;
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
  @ApiPropertyOptional({ type: [String], description: 'User IDs duoc gan rieng; de trong thi ap dung cho tat ca khach' })
  @IsOptional() @IsUUID('4', { each: true }) customerIds?: string[];
  @ApiPropertyOptional({ description: 'Muc "Thong tin" tren man uu dai cua app' })
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @ApiPropertyOptional({ description: 'Muc "Dieu khoan va dieu kien"' })
  @IsOptional() @IsString() @MaxLength(5000) terms?: string;
  @ApiPropertyOptional({ description: 'Muc "Luu y"' })
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

export class CreateTechnicianByAdminDto extends UpsertTechnicianProfileDto {
  @ApiProperty() @IsUUID() userId!: string;
  @ApiPropertyOptional({ description: 'Admin-only Marketplace visibility; defaults to true for new profiles' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdminPageDto {
  @ApiPropertyOptional({ default: 1, type: Number, description: 'Trang bắt đầu từ 1' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;
  @ApiPropertyOptional({ default: 20, type: Number, maximum: 100, description: 'Số bản ghi mỗi trang' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class PromotionListQueryDto extends AdminPageDto {}

export class AdminUsersQueryDto extends AdminPageDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) search?: string;
  @ApiPropertyOptional({ enum: ['CUSTOMER', 'TECHNICIAN', 'ADMIN'] })
  @IsOptional()
  @IsIn(['CUSTOMER', 'TECHNICIAN', 'ADMIN'])
  role?: 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN';
  @ApiPropertyOptional({ enum: ['ACTIVE', 'BLOCKED', 'DELETED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'BLOCKED', 'DELETED'])
  status?: 'ACTIVE' | 'BLOCKED' | 'DELETED';
}

export class AdminBookingsQueryDto extends AdminPageDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] })
  @IsOptional()
  @IsIn(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'])
  status?: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
}

export class RevenueReportQueryDto {
  @ApiPropertyOptional({ enum: ['day', 'week', 'month'], default: 'month', description: 'day = hom nay theo gio, week = tuan nay, month = cac thang trong nam' })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  period?: 'day' | 'week' | 'month';
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'BLOCKED'] }) @IsIn(['ACTIVE', 'BLOCKED']) status!: 'ACTIVE' | 'BLOCKED';
  @ApiPropertyOptional({ example: 'Huy don lien tuc, nghi gian lan', description: 'Bat buoc khi khoa (BLOCKED). Nguoi dung thay ly do nay.' })
  @ValidateIf((dto) => dto.status === 'BLOCKED')
  @IsString({ message: 'Vui long nhap ly do khoa tai khoan' })
  @MinLength(3, { message: 'Vui long nhap ly do khoa tai khoan' })
  @MaxLength(500)
  reason?: string;
}

export class UpdateAdminTechnicianDto extends PartialType(UpsertTechnicianProfileDto) {
  @ApiPropertyOptional({ description: 'false = an ho so (khach khong thay, KTV khong nhan duoc don; van dang nhap duoc).' })
  @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ example: 'Anh dai dien khong phu hop', description: 'Ly do an ho so, KTV duoc thong bao.' })
  @IsOptional() @IsString() @MaxLength(500) hiddenReason?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isVerified?: boolean;
}

/** Admin may change a selling price, but cannot alter the duration/template selected by the technician. */
export class UpdateAdminTechnicianPriceOptionDto {
  @ApiProperty({ example: 500000, description: 'Giá bán bằng VND cho gói thời lượng hiện có (400.000 – 1.000.000).' })
  @Type(() => Number)
  @IsNumber()
  @ServicePriceRange()
  price!: number;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateBannerDto extends PartialType(CreateBannerDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdatePromotionDto extends PartialType(CreatePromotionDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
