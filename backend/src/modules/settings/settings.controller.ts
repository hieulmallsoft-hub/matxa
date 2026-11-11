import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf, IsArray, ArrayMinSize, ArrayUnique, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';
import { SettingsService, SERVICE_MODES, ServiceModeName } from './settings.service';

class UpdateCommissionDto {
  @Type(() => Number)
  @IsInt({ message: "Ty le KTV nhan phai la so nguyen (vd 80)" })
  @Min(0)
  @Max(100)
  technicianSharePercent!: number;
}

class UpdatePlatformInfoDto {
  @ApiPropertyOptional({ example: 'Psyocore' })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100)
  brandName?: string;

  @ApiPropertyOptional({ example: '0901 234 567', description: 'Chuoi rong de xoa' })
  @IsOptional() @IsString() @MaxLength(20) @Matches(/^[0-9+ .()-]*$/, { message: 'Hotline chi gom so, dau cach va + . ( ) -' })
  hotline?: string;

  @ApiPropertyOptional({ example: 'hello.psyocore@gmail.com', description: 'Chuoi rong de xoa' })
  @IsOptional() @IsString() @MaxLength(200) @ValidateIf((dto) => dto.supportEmail !== '') @IsEmail({}, { message: 'Email CSKH khong hop le' })
  supportEmail?: string;
}

class UpdateBookingRulesDto {
  @ApiPropertyOptional({ example: 1, description: 'Khach phai dat truoc it nhat bao nhieu gio. 0 = khong gioi han.' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(72)
  minAdvanceHours?: number;

  @ApiPropertyOptional({ example: 15, description: 'Chi goi y va gui don cho KTV trong ban kinh nay (km). 0 = khong gioi han.' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(200)
  maxDispatchRadiusKm?: number;

  @ApiPropertyOptional({ example: 10, description: 'Don tai nha co khoang cach khach-KTV vuot so km nay thi cong phi di chuyen.' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(200)
  travelFeeThresholdKm?: number;

  @ApiPropertyOptional({ example: 50000, description: 'Phi di chuyen co dinh (VND), KTV nhan 100%. 0 = khong thu phi di chuyen.' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(5_000_000)
  travelFeeAmount?: number;

  @ApiPropertyOptional({ example: 10, description: 'Don moi cho KTV xac nhan bao nhieu phut truoc khi het han.' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60)
  confirmationWaitMinutes?: number;

  @ApiPropertyOptional({ example: false, description: 'Bat = KTV chua co so dien thoai khong nhan duoc don (409 PHONE_REQUIRED).' })
  @IsOptional() @IsBoolean()
  requireTechnicianPhone?: boolean;

  @ApiPropertyOptional({ example: 100000, description: 'Phu phi (VND) cong vao moi don tai nha. 0 = khong thu.' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(5_000_000)
  homeServiceFee?: number;

  @ApiPropertyOptional({ example: 5, description: 'KTV hoan thanh du so don nay trong ngay thi cac don nhan sau do chi bi tru dailyDiscountFeePercent. 0 = tat.' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  dailyDiscountThreshold?: number;

  @ApiPropertyOptional({ example: 20, description: 'Phi chiet khau (%) sau khi KTV dat moc don trong ngay. So nguyen 0-100.' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  dailyDiscountFeePercent?: number;

  @ApiPropertyOptional({
    example: ['HOME', 'ONLINE'],
    enum: SERVICE_MODES,
    isArray: true,
    description: 'Noi phuc vu dang mo (HOME = tan noi, ONLINE, ONSITE = co so). It nhat 1. App an cac lua chon bi tat.',
  })
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayUnique() @IsIn(SERVICE_MODES, { each: true })
  enabledServiceModes?: ServiceModeName[];
}

@ApiTags('Admin Settings')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('commission')
  @ApiOperation({ summary: 'Lay ty le hoa hong KTV' })
  getCommission() { return this.settings.getCommission(); }

  @Patch('commission')
  @ApiOperation({ summary: 'Admin cap nhat ty le KTV nhan' })
  setCommission(@Body() dto: UpdateCommissionDto) { return this.settings.setCommission(dto.technicianSharePercent); }

  @Get('platform')
  @ApiOperation({ summary: 'Lay thong tin nen tang (ten thuong hieu, hotline, email CSKH)' })
  getPlatformInfo() { return this.settings.getPlatformInfo(); }

  @Patch('platform')
  @ApiOperation({ summary: 'Admin cap nhat thong tin nen tang', description: 'Chi gui truong can doi.' })
  setPlatformInfo(@Body() dto: UpdatePlatformInfoDto) { return this.settings.setPlatformInfo(dto); }

  @Get('booking')
  @ApiOperation({ summary: 'Lay quy dinh dat lich (dat truoc toi thieu, ban kinh dieu phoi)' })
  getBookingRules() { return this.settings.getBookingRules(); }

  @Patch('booking')
  @ApiOperation({ summary: 'Admin cap nhat quy dinh dat lich', description: 'Chi gui truong can doi. 0 = khong gioi han.' })
  setBookingRules(@Body() dto: UpdateBookingRulesDto) { return this.settings.setBookingRules(dto); }
}

@ApiTags('Settings')
@Controller('settings')
export class PublicSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('public')
  @ApiOperation({
    summary: 'Thong tin nen tang va quy dinh dat lich cho app',
    description: 'Khong can dang nhap. Mobile dung hotline/email de hien thi lien he, minAdvanceHours de gioi han lich chon gio.',
  })
  publicSettings() { return this.settings.publicSettings(); }
}
