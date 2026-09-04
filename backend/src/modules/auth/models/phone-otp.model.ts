import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendPhoneOtpResponse {
  @ApiProperty({ format: 'uuid' })
  challengeId!: string;

  @ApiProperty({ example: 300 })
  expiresIn!: number;

  @ApiProperty({ example: 60 })
  resendAfter!: number;

  @ApiPropertyOptional({
    example: '123456',
    description: 'Chi co trong development; khong bao gio tra ve o production',
  })
  debugOtp?: string;
}
