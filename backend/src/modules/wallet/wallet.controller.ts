import {
  WalletBalanceResponseDto,
  WalletTopupCreateResponseDto,
  WalletTopupDetailResponseDto,
  WalletTopupItemResponseDto,
  WalletTopupListResponseDto,
  WalletTransactionListResponseDto,
  WalletTransactionResponseDto,
} from './wallet-response.dto';
import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { BookingsService } from '../bookings/services/bookings.service';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { AccessTokenPayload } from '../auth/entities/access-token-payload.entity';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WalletService } from './wallet.service';
import { WalletTopupCreateDto } from './wallet.dto';

@ApiTags('Wallet')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}
  @Get() @ApiOkResponse({ type: WalletBalanceResponseDto })
  balance(@CurrentAuth() auth: AccessTokenPayload) {
    return this.wallet.balance(auth.sub);
  }
  @Post('topups')
  @ApiBody({ type: WalletTopupCreateDto })
  @ApiCreatedResponse({ type: WalletTopupCreateResponseDto })
  create(
    @CurrentAuth() auth: AccessTokenPayload,
    @Body() body: WalletTopupCreateDto,
  ) {
    return this.wallet.create(auth.sub, body.amount, body.paymentMethod);
  }
  @Get('topups') @ApiOkResponse({ type: WalletTopupListResponseDto })
  list(
    @CurrentAuth() auth: AccessTokenPayload,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.wallet.list(auth.sub, Number(page), Number(limit));
  }
  @Get('topups/:id') @ApiOkResponse({ type: WalletTopupDetailResponseDto })
  detail(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.wallet.detail(auth.sub, id);
  }
  @Get('transactions') @ApiOkResponse({ type: WalletTransactionListResponseDto })
  transactions(
    @CurrentAuth() auth: AccessTokenPayload,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.wallet.transactions(auth.sub, Number(page), Number(limit));
  }
  @Get('transactions/:id') @ApiOkResponse({ type: WalletTransactionResponseDto })
  transactionDetail(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.wallet.transactionDetail(auth.sub, id);
  }
}

/**
 * The one PayOS webhook. PayOS sends every event of the channel to the single URL saved in its dashboard, so both
 * addresses accept both kinds: a wallet top-up, otherwise a booking payment.
 */
@ApiTags('PayOS')
@Controller('payments/payos')
export class WalletPayosWebhookController {
  constructor(private readonly wallet: WalletService, private readonly bookings: BookingsService) {}
  @Post(['webhook', 'wallet/webhook'])
  @HttpCode(200)
  @ApiOperation({ summary: 'PayOS webhook (nap vi va thanh toan don); chi PayOS duoc phep goi' })
  webhook(@Body() body: Record<string, unknown>) {
    return this.wallet.processPayosWebhook(body, (event) => this.bookings.processPayosWebhook(event));
  }
}

@ApiTags('Admin - Wallet')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/wallet')
export class AdminWalletController {
  constructor(private readonly wallet: WalletService) {}
  @Get('topups') @ApiOkResponse({ type: WalletTopupListResponseDto })
  list(
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('referenceCode') referenceCode?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.wallet.adminList({ status, userId, referenceCode, page: Number(page), limit: Number(limit) });
  }
  @Get('topups/:id') @ApiOkResponse({ type: WalletTopupDetailResponseDto })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.wallet.adminDetail(id);
  }
  @Post('topups/:id/simulate-processing') @ApiOkResponse({ type: WalletTopupItemResponseDto })
  processing(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.wallet.simulateProcessing(auth.sub, id);
  }
  @Post('topups/:id/simulate-success') @ApiOkResponse({ type: WalletTopupItemResponseDto })
  success(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.wallet.simulate(auth.sub, id, true);
  }
  @Post('topups/:id/simulate-failure') @ApiOkResponse({ type: WalletTopupItemResponseDto })
  failure(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ) {
    return this.wallet.simulate(auth.sub, id, false, body?.reason);
  }
}
