import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { AccessTokenPayload } from '../auth/entities/access-token-payload.entity';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WalletService } from './wallet.service';

@ApiTags('Wallet')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}
  @Get() balance(@CurrentAuth() auth: AccessTokenPayload) {
    return this.wallet.balance(auth.sub);
  }
  @Post('topups') create(
    @CurrentAuth() auth: AccessTokenPayload,
    @Body() body: { amount: number; paymentMethod?: string },
  ) {
    return this.wallet.create(auth.sub, body.amount, body.paymentMethod);
  }
  @Get('topups') list(
    @CurrentAuth() auth: AccessTokenPayload,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.wallet.list(auth.sub, Number(page), Number(limit));
  }
  @Get('topups/:id') detail(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.wallet.detail(auth.sub, id);
  }
}

@ApiTags('Admin - Wallet')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/wallet')
export class AdminWalletController {
  constructor(private readonly wallet: WalletService) {}
  @Get('topups') list(
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('referenceCode') referenceCode?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.wallet.adminList({ status, userId, referenceCode, page: Number(page), limit: Number(limit) });
  }
  @Get('topups/:id') detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.wallet.adminDetail(id);
  }
  @Post('topups/:id/simulate-processing') processing(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.wallet.simulateProcessing(auth.sub, id);
  }
  @Post('topups/:id/simulate-success') success(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.wallet.simulate(auth.sub, id, true);
  }
  @Post('topups/:id/simulate-failure') failure(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ) {
    return this.wallet.simulate(auth.sub, id, false, body?.reason);
  }
}
