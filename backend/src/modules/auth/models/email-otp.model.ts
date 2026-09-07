import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendEmailOtpResponse {
  @ApiProperty() challengeId!: string;
  @ApiProperty() expiresIn!: number;
  @ApiPropertyOptional({ description: 'Development only' }) debugOtp?: string;
}
