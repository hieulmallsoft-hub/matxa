import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class EmailLoginDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
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
