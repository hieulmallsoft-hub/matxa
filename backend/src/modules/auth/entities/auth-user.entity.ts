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

  @ApiProperty({ description: 'Tai khoan co mat khau (dang ky bang email). false = an nut Doi mat khau' })
  hasPassword!: boolean;

  @ApiPropertyOptional({ example: 'user@example.com' })
  email?: string;

  @ApiPropertyOptional({ example: 'Psyocore User' })
  name?: string;

  @ApiPropertyOptional({ format: 'uri' })
  avatarUrl?: string;

  @ApiProperty({ enum: ['CUSTOMER', 'TECHNICIAN', 'ADMIN'] })
  role!: 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN';

  @ApiProperty({ enum: ['ACTIVE', 'BLOCKED', 'DELETED'] })
  status!: 'ACTIVE' | 'BLOCKED' | 'DELETED';

  @ApiProperty({ description: 'Da hoan tat dang ky tai khoan' })
  onboardingCompleted!: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Chi co o GET /auth/me. Dang tam khoa: van dang nhap duoc nhung khong dat don (khach) / nhan don (KTV) den endsAt.',
    example: { level: 2, reason: 'Huy 3 don da co KTV nhan trong 24 gio', endsAt: '2026-11-14T03:00:00.000Z' },
  })
  suspension?: { level: number; reason: string; endsAt: Date } | null;
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
