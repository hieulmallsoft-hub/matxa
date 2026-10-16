import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WalletBalanceResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'ADVERTISING_CREDIT' }) type!: string;
  @ApiProperty() balanceVnd!: number;
  @ApiProperty({ example: 'VND' }) currency!: string;
}

export class WalletTopupCreateResponseDto {
  @ApiProperty() transactionId!: string;
  @ApiProperty() amount!: number;
  @ApiProperty({ example: 'VND' }) currency!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ example: 'BANK_TRANSFER' }) paymentMethod!: string;
  @ApiPropertyOptional({ type: Object, nullable: true }) bank?: { bankName: string; accountName: string; accountNumber: string } | null;
  @ApiProperty() referenceCode!: string;
  @ApiProperty() transferContent!: string;
  @ApiProperty() expiresAt!: string;
  @ApiPropertyOptional() checkoutUrl?: string;
  @ApiPropertyOptional() qrCode?: string;
  @ApiPropertyOptional() accountNumber?: string;
  @ApiPropertyOptional() accountName?: string;
}

export class WalletTopupItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() walletId!: string;
  @ApiProperty() amountVnd!: number;
  @ApiProperty() status!: string;
  @ApiProperty() paymentMethod!: string;
  @ApiProperty() referenceCode!: string;
  @ApiPropertyOptional() failureCode?: string;
  @ApiPropertyOptional() failureMessage?: string;
  @ApiPropertyOptional() expiresAt?: string;
  @ApiPropertyOptional() processedAt?: string;
  @ApiProperty() createdAt!: string;
}

export class WalletTopupListResponseDto {
  @ApiProperty({ type: [WalletTopupItemResponseDto] }) items!: WalletTopupItemResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export class WalletTopupDetailResponseDto extends WalletTopupItemResponseDto {
  @ApiPropertyOptional({ type: Object, nullable: true }) bank?: { bankName: string; accountName: string; accountNumber: string } | null;
  @ApiProperty() transferContent!: string;
}
