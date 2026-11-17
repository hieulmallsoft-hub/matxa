import { Controller, Get, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { BookingsService } from '../services/bookings.service';

// The webhook itself (one URL for wallet top-ups and booking payments) lives in WalletModule: PayosWebhookDispatchController.
@ApiTags('PayOS')
@Controller('payments/payos')
export class PayosWebhookController {
  constructor(private readonly bookings: BookingsService) {}

  @Get('return')
  @ApiOperation({ summary: 'PayOS redirect sau khi thanh toan; chi dieu huong ve mobile' })
  @ApiFoundResponse({ description: 'Redirect ve deep link mobile' })
  async returned(@Query() query: Record<string, string | undefined>, @Res() response: Response) {
    // Check the payment before the app opens again, so it already shows "paid" even if the webhook is late or lost.
    await this.bookings.syncPayosOrder(query.orderCode);
    return response.redirect(this.bookings.payosMobileRedirect('return', query));
  }

  @Get('cancel')
  @ApiOperation({ summary: 'PayOS redirect khi khach huy; chi dieu huong ve mobile' })
  @ApiFoundResponse({ description: 'Redirect ve deep link mobile' })
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

  @Post(':id/payos-payment/check')
  @ApiOperation({ summary: 'Hoi lai PayOS don da thanh toan chua (goi khi quay ve tu trang thanh toan / nut "Toi da thanh toan")' })
  @ApiOkResponse({ schema: { type: 'object', properties: { bookingId: { type: 'string' }, paymentStatus: { type: 'string', example: 'PAID' } } } })
  check(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.checkPayosPayment(auth.sub, id);
  }
}

@ApiTags('Admin Payouts & Refunds')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/bookings')
export class AdminPayosController {
  constructor(private readonly bookings: BookingsService) {}

  @Post(':id/payment/check')
  @ApiOperation({ summary: 'Admin: hoi lai PayOS don nay da thanh toan chua va cap nhat (don da huy ma da tra -> tao yeu cau hoan tien)' })
  check(@Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.checkWithPayos(id).then((result) => ({ bookingId: id, ...result }));
  }
}
