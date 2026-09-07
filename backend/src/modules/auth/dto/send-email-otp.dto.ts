import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendEmailOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'android-device-id' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  deviceId!: string;
}
