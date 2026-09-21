import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartPasswordResetResponse {
  @ApiProperty() passwordResetSessionId!: string;
  @ApiProperty() expiresIn!: number;
  @ApiPropertyOptional({ description: 'Development only' }) debugOtp?: string;
}

export class VerifyPasswordResetResponse {
  @ApiProperty({ example: true }) verified!: boolean;
  @ApiProperty() expiresIn!: number;
}

export class CompletePasswordResetResponse {
  @ApiProperty({ example: true }) completed!: boolean;
}
