import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class WalletTopupCreateDto {
  @ApiProperty({ example: 1000, description: 'Số tiền nạp, đơn vị VND; tối thiểu 1.000đ' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({ enum: ['BANK_TRANSFER', 'PAYOS'], default: 'BANK_TRANSFER' })
  @IsOptional()
  @IsIn(['BANK_TRANSFER', 'PAYOS'])
  paymentMethod?: 'BANK_TRANSFER' | 'PAYOS';
}
