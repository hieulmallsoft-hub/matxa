import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TestPushDto {
  @ApiPropertyOptional({ default: 'Matxa test notification' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ default: 'Firebase Cloud Messaging da hoat dong.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  body?: string;
}
