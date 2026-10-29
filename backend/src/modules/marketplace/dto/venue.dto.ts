import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class VenueServiceDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(1440) durationMinutes!: number;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) @Max(1000000000) price!: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() catalogServiceId?: string;
}

export class VenueHourDto {
  @ApiProperty({ description: '0 = Chủ nhật, 1 = Thứ Hai, ... 6 = Thứ Bảy' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isClosed?: boolean;
  @ApiPropertyOptional({ example: '09:00' })
  @ValidateIf((hour) => !hour.isClosed)
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  openTime?: string;
  @ApiPropertyOptional({ example: '22:00' })
  @ValidateIf((hour) => !hour.isClosed)
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  closeTime?: string;
}

export class CreateVenueDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;
  @ApiPropertyOptional({ enum: ['MASSAGE_SPA', 'CONSULTATION', 'TRAINING'] })
  @IsOptional()
  @IsIn(['MASSAGE_SPA', 'CONSULTATION', 'TRAINING'])
  category?: 'MASSAGE_SPA' | 'CONSULTATION' | 'TRAINING';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  address!: string;
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  city!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) district?: string;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false }, { each: true })
  images?: string[];
  @ApiPropertyOptional({ type: [VenueServiceDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => VenueServiceDto)
  services?: VenueServiceDto[];
  @ApiPropertyOptional({ type: [VenueHourDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => VenueHourDto)
  hours?: VenueHourDto[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateVenueDto extends PartialType(CreateVenueDto, { skipNullProperties: false }) {}

export class VenueQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() district?: string;
  @ApiPropertyOptional({ enum: ['MASSAGE_SPA', 'CONSULTATION', 'TRAINING'] })
  @IsOptional()
  @IsIn(['MASSAGE_SPA', 'CONSULTATION', 'TRAINING'])
  category?: 'MASSAGE_SPA' | 'CONSULTATION' | 'TRAINING';
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number;
}
