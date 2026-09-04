import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FirebaseLoginDto {
  @ApiProperty({ description: 'Google hoac Firebase ID token nhan tu client' })
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  @ApiPropertyOptional({ example: 'android-device-id' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  deviceId?: string;
}
