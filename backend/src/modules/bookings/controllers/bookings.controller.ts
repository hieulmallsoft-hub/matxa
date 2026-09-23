import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BookingQuoteResponse } from '../entities/booking-quote.entity';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { BookingsService } from '../services/bookings.service';
import { CancelBookingDto, CreateBookingDto, CreateReviewDto, QuoteBookingDto, UpdateBookingStatusDto } from '../dto/booking.dto';

@ApiTags('Bookings')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post('quote')
  @ApiCreatedResponse({ type: BookingQuoteResponse })
  @ApiOperation({ summary: 'Kiem tra lich, ma khuyen mai va tinh tong tien' })
  quote(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: QuoteBookingDto) {
    return this.bookings.quote(auth.sub, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Tao lich dat va khoa khung gio' })
  create(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: CreateBookingDto) {
    return this.bookings.create(auth.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sach lich cua khach hoac ky thuat vien' })
  list(@CurrentAuth() auth: AccessTokenPayload) {
    return this.bookings.listMine(auth.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiet lich dat' })
  detail(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.detail(auth.sub, id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Huy lich dat' })
  cancel(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelBookingDto) {
    return this.bookings.cancel(auth.sub, id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Ky thuat vien xac nhan/hoan thanh lich' })
  status(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBookingStatusDto) {
    return this.bookings.updateStatus(auth.sub, id, dto);
  }

  @Post(':id/review')
  @ApiOperation({ summary: 'Khach hang danh gia lich da hoan thanh' })
  review(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateReviewDto) {
    return this.bookings.review(auth.sub, id, dto);
  }
}
