import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';

export class VerifyPasswordResetOtpDto {
  @ApiProperty() @IsString() @IsNotEmpty()
  passwordResetSessionId!: string;

  @ApiProperty({ example: '123456' }) @IsString() @Length(6, 6)
  code!: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200)
  deviceId!: string;
}
