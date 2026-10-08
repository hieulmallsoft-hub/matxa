import { Controller, Get, Ip, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { BookingsService } from '../services/bookings.service';

@ApiTags('VNPAY')
@Controller('payments/vnpay')
export class VnpayController {
  constructor(private readonly bookings: BookingsService) {}
  @Get('ipn')
  @ApiOperation({ summary: 'VNPAY IPN callback; do not call from Mobile' })
  ipn(@Query() query: Record<string, string | undefined>) {
    return this.bookings.processVnpayIpn(query);
  }
  @Get('return')
  @ApiOperation({ summary: 'VNPAY return URL after customer completes payment' })
  returned(@Query() query: Record<string, string | undefined>) {
    return this.bookings.vnpayReturn(query);
  }
}

@ApiTags('Bookings')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('bookings')
export class BookingVnpayController {
  constructor(private readonly bookings: BookingsService) {}
  @Post(':id/vnpay-payment')
  @ApiOperation({ summary: 'Tao VNPAY payment URL cho booking ONLINE cua khach hang' })
  create(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Ip() ip: string) {
    return this.bookings.createVnpayPayment(auth.sub, id, ip);
  }
}
