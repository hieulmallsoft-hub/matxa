import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class RegisterEmailDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  challengeId!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  deviceId!: string;
}
