import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BookingQuoteResponse } from '../entities/booking-quote.entity';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { BookingsService } from '../services/bookings.service';
import {
  BookingHistoryQueryDto,
  CancelBookingDto,
  CreateBookingDto,
  CreateOpenBookingDto,
  CreateReviewDto,
  QuoteBookingDto,
  SelectTechnicianDto,
  UpdateBookingStatusDto,
} from '../dto/booking.dto';

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
  @ApiCreatedResponse({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string' },
        scheduledStart: { type: 'string', format: 'date-time' },
        scheduledEnd: { type: 'string', format: 'date-time' },
        totalAmount: { type: 'number' },
        payment: { type: 'object' },
      },
    },
  })
  create(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: CreateBookingDto) {
    return this.bookings.create(auth.sub, dto);
  }

  @Post('open')
  @ApiOperation({ summary: 'Tao don mo marketplace tu dich vu catalog chung' })
  @ApiCreatedResponse({
    schema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string' },
        bookingStatus: { type: 'string', example: 'OPEN' },
        assignmentMode: { type: 'string', example: 'OPEN_MARKETPLACE' },
        scheduledStart: { type: 'string', format: 'date-time' },
        scheduledEnd: { type: 'string', format: 'date-time' },
        items: { type: 'array', items: { type: 'object' } },
        totalAmount: { type: 'number' },
      },
    },
  })
  createOpen(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: CreateOpenBookingDto) {
    return this.bookings.createOpen(auth.sub, dto);
  }

  @Post(':id/select-technician')
  @ApiOperation({ summary: 'Khach chon mot KTV da ung tuyen cho don OPEN' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string' },
        bookingStatus: { type: 'string', example: 'CONFIRMED' },
        technicianId: { type: 'string' },
        applicationStatus: { type: 'string', example: 'SELECTED' },
      },
    },
  })
  selectTechnician(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SelectTechnicianDto,
  ) {
    return this.bookings.selectTechnician(auth.sub, id, dto.applicationId);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sach lich cua khach hoac ky thuat vien' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object' } },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  list(@CurrentAuth() auth: AccessTokenPayload, @Query() query: BookingHistoryQueryDto) {
    return this.bookings.listMine(auth.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiet lich dat' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string' },
        assignmentMode: { type: 'string' },
        scheduledStart: { type: 'string', format: 'date-time' },
        scheduledEnd: { type: 'string', format: 'date-time' },
        items: { type: 'array', items: { type: 'object' } },
        paymentStatus: { type: 'string', nullable: true },
      },
    },
  })
  detail(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.detail(auth.sub, id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Huy lich dat' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', example: 'CANCELLED' },
        cancellation: { type: 'object', nullable: true },
      },
    },
  })
  cancel(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookings.cancel(auth.sub, id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Ky thuat vien xac nhan/hoan thanh lich' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  status(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.bookings.updateStatus(auth.sub, id, dto);
  }

  @Post(':id/review')
  @ApiOperation({ summary: 'Khach hang danh gia lich da hoan thanh' })
  review(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.bookings.review(auth.sub, id, dto);
  }
}
