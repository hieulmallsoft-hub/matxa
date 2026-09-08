import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendEmailOtpResponse {
  @ApiProperty() registrationSessionId!: string;
  @ApiProperty() expiresIn!: number;
  @ApiPropertyOptional({ description: 'Development only' }) debugOtp?: string;
}

export class VerifyRegistrationOtpResponse {
  @ApiProperty({ example: true }) verified!: boolean;
  @ApiProperty() expiresIn!: number;
}
