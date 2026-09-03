import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token do backend Matxa cap' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  refreshToken!: string;
}
