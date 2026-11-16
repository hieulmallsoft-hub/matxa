import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { PayoutsService } from '../services/payouts.service';

class MarkPayoutPaidDto {
  @ApiProperty({ description: 'upTo cua dong trong GET /admin/payouts/pending' }) @IsDateString() upTo!: string;
  @ApiProperty({ description: 'So tien da chuyen (phai bang amount cua dong do)' }) @Type(() => Number) @IsInt() @Min(1) amount!: number;
}

class MarkRefundedDto {
  @ApiPropertyOptional({ example: 'Da chuyen khoan VCB 16/11' }) @IsOptional() @IsString() @MaxLength(500) note?: string;
}

@ApiTags('Admin Payouts & Refunds')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminPayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get('payouts/pending')
  @ApiOperation({ summary: 'KTV can chi tra (thu nhap don truc tuyen chua chi, tu muc toi thieu), kem ma VietQR' })
  pending() {
    return this.payouts.pendingPayouts();
  }

  @Post('payouts/:technicianUserId/paid')
  @ApiOperation({ summary: 'Xac nhan da chuyen khoan cho KTV (cac khoan den upTo)' })
  markPaid(@CurrentAuth() auth: AccessTokenPayload, @Param('technicianUserId', ParseUUIDPipe) technicianUserId: string, @Body() dto: MarkPayoutPaidDto) {
    return this.payouts.markPaid(auth.sub, technicianUserId, dto);
  }

  @Get('payouts')
  @ApiOperation({ summary: 'Lich su chi tra cho KTV' })
  history() {
    return this.payouts.payoutHistory();
  }

  @Get('refunds')
  @ApiOperation({ summary: 'Khoan can hoan cho khach (don truc tuyen da thanh toan bi huy), kem tai khoan khach da tra va VietQR' })
  refunds(@Query('status') status?: string) {
    return this.payouts.refunds(status === 'DONE' ? 'DONE' : 'PENDING');
  }

  @Post('refunds/:id/done')
  @ApiOperation({ summary: 'Xac nhan da hoan tien cho khach' })
  markRefunded(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MarkRefundedDto) {
    return this.payouts.markRefunded(auth.sub, id, dto.note);
  }
}

@ApiTags('Technician Earnings')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('TECHNICIAN')
@Controller('technician/earnings')
export class TechnicianEarningsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get()
  @ApiOperation({
    summary: 'Thu nhap don truc tuyen cua KTV: cho chi tra va da chi',
    description: 'Don truc tuyen khach tra online cho nen tang; hoan thanh don thi phan cua KTV (gia tru hoa hong) vao unpaid, admin chuyen khoan dinh ky.',
  })
  earnings(@CurrentAuth() auth: AccessTokenPayload) {
    return this.payouts.technicianEarnings(auth.sub);
  }
}
