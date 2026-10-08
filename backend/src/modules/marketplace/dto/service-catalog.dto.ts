import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CatalogPriceOptionDto {
  @ApiProperty() @IsString() @MaxLength(50) code!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(15) @Max(720) durationMinutes!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) price!: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateServiceCatalogDto {
  @ApiProperty() @IsUUID() categoryId!: string;
  @ApiProperty() @IsString() @MaxLength(100) slug!: string;
  @ApiProperty() @IsString() @MaxLength(150) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @ApiProperty({ enum: ['STANDARD_60_90_120', 'FIXED_60', 'DATE_2_4_6_HOURS'] })
  @IsIn(['STANDARD_60_90_120', 'FIXED_60', 'DATE_2_4_6_HOURS'])
  pricingTemplate!: 'STANDARD_60_90_120' | 'FIXED_60' | 'DATE_2_4_6_HOURS';
  @ApiProperty({ enum: ['HOME', 'ONSITE', 'ONLINE'], isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(['HOME', 'ONSITE', 'ONLINE'], { each: true })
  modes!: ('HOME' | 'ONSITE' | 'ONLINE')[];
  @ApiProperty({ type: [CatalogPriceOptionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  priceOptions!: CatalogPriceOptionDto[];
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateServiceCatalogDto extends PartialType(CreateServiceCatalogDto) {}

export class ServiceCatalogQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional({ enum: ['HOME', 'ONSITE', 'ONLINE'] }) @IsOptional() @IsIn(['HOME', 'ONSITE', 'ONLINE']) mode?:
    'HOME' | 'ONSITE' | 'ONLINE';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) search?: string;
}
