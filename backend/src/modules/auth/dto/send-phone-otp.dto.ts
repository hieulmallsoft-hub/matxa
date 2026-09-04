import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class SendPhoneOtpDto {
  @ApiProperty({ example: '+84394338212' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phoneNumber!: string;

  @ApiProperty({ example: 'android-installation-id' })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  deviceId!: string;
}
