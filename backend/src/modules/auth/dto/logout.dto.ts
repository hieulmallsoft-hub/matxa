import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({ description: 'FCM token cua may dang dang xuat, de may nay thoi nhan thong bao' })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  deviceToken?: string;
}
