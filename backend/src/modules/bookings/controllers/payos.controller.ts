import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
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

  @Get('return')
  @ApiOperation({ summary: 'PayOS redirect sau khi thanh toan; chi dieu huong ve mobile' })
  returned(@Query() query: Record<string, string | undefined>, @Res() response: Response) {
    return response.redirect(this.bookings.payosMobileRedirect('return', query));
  }

  @Get('cancel')
  @ApiOperation({ summary: 'PayOS redirect khi khach huy; chi dieu huong ve mobile' })
  cancelled(@Query() query: Record<string, string | undefined>, @Res() response: Response) {
    return response.redirect(this.bookings.payosMobileRedirect('cancel', query));
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
  @ApiCreatedResponse({
    schema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string' },
        paymentId: { type: 'string' },
        status: { type: 'string', example: 'PENDING' },
        paymentUrl: { type: 'string', format: 'uri' },
        qrCode: { type: 'string', nullable: true },
        accountNumber: { type: 'string', nullable: true },
        accountName: { type: 'string', nullable: true },
        expiresAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  create(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.createPayosPayment(auth.sub, id);
  }
}
