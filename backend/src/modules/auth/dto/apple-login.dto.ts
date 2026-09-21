import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AppleLoginDto {
  @ApiProperty({ description: 'Identity token JWT nhan tu Sign in with Apple' })
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  @ApiProperty({ description: 'Nonce goc tu POST /api/auth/apple/start; gui SHA-256 hex cua nonce nay cho Apple. Nonce chi dung mot lan, het han sau 300 giay.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  nonce!: string;

  @ApiPropertyOptional({ description: 'Ten Apple chi tra o lan cap quyen dau tien', example: 'Thu Huong' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({ example: 'ios-installation-id' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  deviceId?: string;
}
