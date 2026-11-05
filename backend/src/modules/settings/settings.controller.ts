import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';

class UpdateCommissionDto {
  @Type(() => Number)
  @IsNumber()
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
