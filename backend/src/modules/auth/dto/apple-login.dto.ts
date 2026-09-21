import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AppleLoginDto {
  @ApiProperty({ description: 'Identity token JWT nhan tu Sign in with Apple' })
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  @ApiProperty({ description: 'Raw nonce do mobile tao; token Apple phai chua SHA-256 cua nonce nay' })
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
