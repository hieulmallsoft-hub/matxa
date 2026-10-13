import { ApiPropertyOptional } from '@nestjs/swagger';

/** Explicit fields shared by mutation/action responses in the mobile API. */
export class ApiActionResponseDto {
  @ApiPropertyOptional() id?: string;
  @ApiPropertyOptional() bookingId?: string;
  @ApiPropertyOptional() paymentId?: string;
  @ApiPropertyOptional() status?: string;
  @ApiPropertyOptional() message?: string;
  @ApiPropertyOptional() success?: boolean;
  @ApiPropertyOptional() paymentUrl?: string;
  @ApiPropertyOptional() uploadUrl?: string;
  @ApiPropertyOptional() storageKey?: string;
  @ApiPropertyOptional() expiresAt?: string;
  @ApiPropertyOptional({ type: Object }) data?: Record<string, unknown>;
}

export class ApiListResponseDto {
  @ApiPropertyOptional({ type: [Object] }) items?: unknown[];
  @ApiPropertyOptional() total?: number;
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional() limit?: number;
}

export class ApiItemListResponseDto {
  @ApiPropertyOptional({ type: [Object] }) data?: unknown[];
  @ApiPropertyOptional() total?: number;
  @ApiPropertyOptional() page?: number;
  @ApiPropertyOptional() limit?: number;
}
