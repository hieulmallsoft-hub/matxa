import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type AuthProvider = 'phone' | 'google.com';

export class AuthUser {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['phone', 'google.com'] })
  provider!: AuthProvider;

  @ApiPropertyOptional({ example: '+84901234567' })
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  email?: string;

  @ApiPropertyOptional({ example: 'Matxa User' })
  name?: string;

  @ApiPropertyOptional({ format: 'uri' })
  avatarUrl?: string;
}

export class AuthResponse {
  @ApiProperty({ description: 'JWT ngan han dung cho Bearer authentication' })
  accessToken!: string;

  @ApiProperty({ description: 'Token dung mot lan de xoay vong session' })
  refreshToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({ example: '15m' })
  expiresIn!: string;

  @ApiProperty({ type: () => AuthUser })
  user!: AuthUser;
}
