import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDeviceTokenDto {
  @ApiProperty({ description: 'FCM registration token lay tu Firebase Messaging tren mobile' })
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  token!: string;

  @ApiProperty({ enum: ['ANDROID', 'IOS'], default: 'ANDROID' })
  @IsIn(['ANDROID', 'IOS'])
  platform: 'ANDROID' | 'IOS' = 'ANDROID';

  @ApiPropertyOptional({ description: 'Ma thiet bi do ung dung mobile tao' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceId?: string;
}

export class RemoveDeviceTokenDto {
  @ApiProperty({ description: 'FCM registration token can go khi dang xuat' })
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  token!: string;
}
