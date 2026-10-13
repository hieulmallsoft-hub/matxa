import { Body, Controller, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { BookingsService } from '../services/bookings.service';

@ApiTags('PayOS')
@Controller('payments/payos')
export class PayosWebhookController {
  constructor(private readonly bookings: BookingsService) {}

  @Post('webhook')
  @ApiOperation({ summary: 'PayOS webhook; chi PayOS duoc phep goi' })
  webhook(@Body() body: Record<string, unknown>) {
    return this.bookings.processPayosWebhook(body);
  }
}

@ApiTags('Bookings')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('bookings')
export class BookingPayosController {
  constructor(private readonly bookings: BookingsService) {}

  @Post(':id/payos-payment')
  @ApiOperation({ summary: 'Tao PayOS payment URL cho booking ONLINE' })
  create(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.createPayosPayment(auth.sub, id);
  }
}
