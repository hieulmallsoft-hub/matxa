import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type AuthProvider = 'email' | 'google.com' | 'apple.com' | 'phone';

export class AuthUser {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['email', 'google.com', 'apple.com', 'phone'] })
  provider!: AuthProvider;

  @ApiPropertyOptional({ example: '+84901234567' })
  phoneNumber?: string;

  @ApiProperty({ description: 'Da xac thuc so dien thoai de dat dich vu' })
  phoneVerified!: boolean;

  @ApiPropertyOptional({ example: 'user@example.com' })
  email?: string;

  @ApiPropertyOptional({ example: 'Matxa User' })
  name?: string;

  @ApiPropertyOptional({ format: 'uri' })
  avatarUrl?: string;

  @ApiProperty({ enum: ['CUSTOMER', 'TECHNICIAN', 'ADMIN'] })
  role!: 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN';

  @ApiProperty({ description: 'Da hoan tat dang ky tai khoan' })
  onboardingCompleted!: boolean;
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
