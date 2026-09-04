import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class VerifyPhoneOtpDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  challengeId!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;

  @ApiProperty({ example: 'android-installation-id' })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  deviceId!: string;
}
