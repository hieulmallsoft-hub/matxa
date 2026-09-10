import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CompletePasswordResetDto {
  @ApiProperty() @IsString() @IsNotEmpty()
  passwordResetSessionId!: string;

  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) @MaxLength(72)
  newPassword!: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200)
  deviceId!: string;
}
