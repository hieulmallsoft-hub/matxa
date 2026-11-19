import { BookingReviewResponseDto } from './bookings-response.dto';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BookingQuoteResponse } from '../entities/booking-quote.entity';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { BookingsService } from '../services/bookings.service';
import { ComplaintStorageService } from '../services/complaint-storage.service';
import {
  BookingHistoryQueryDto,
  CancelBookingDto,
  CreateBookingDto,
  CreateOpenBookingDto,
  CreateUnifiedBookingDto,
  MatchTechniciansDto,
  CreateReviewDto,
  CreateComplaintDto,
  QuoteBookingDto,
  SelectTechnicianDto,
  UpdateBookingStatusDto,
} from '../dto/booking.dto';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

/** Refund of a cancelled paid online booking, as queued for the admin. Only the booking's customer gets it. */
const refundSchema: SchemaObject = {
  type: 'object',
  nullable: true,
  description:
    'Tien hoan cua don truc tuyen da thanh toan roi bi huy (chi khach cua don thay; KTV luon null). null = khong co tien hoan ' +
    '(don chua tra, don 0d, don tai nha/tai co so, don khong bi huy). App hien thang `amount`, khong tu tinh phi huy.',
  properties: {
    status: { type: 'string', enum: ['PENDING', 'DONE'], description: 'PENDING = Psyocore dang xu ly, DONE = da hoan', example: 'PENDING' },
    paidAmount: { type: 'number', description: 'So khach da tra (dong)', example: 2000 },
    feeAmount: { type: 'number', description: 'Phi huy giu lai (0 khi KTV/admin huy)', example: 300 },
    amount: { type: 'number', description: 'So tien hoan cho khach', example: 1700 },
    createdAt: { type: 'string', format: 'date-time', description: 'Luc tao yeu cau hoan (luc don bi huy)' },
    doneAt: { type: 'string', format: 'date-time', nullable: true, description: 'Luc admin bam "Da hoan"; null khi chua hoan' },
  },
};

/** The booking's payment. The payer's bank account and gateway references only reach the booking's customer. */
const paymentSchema: SchemaObject = {
  type: 'object',
  nullable: true,
  description:
    'Thanh toan cua don. Cac truong payer* (tai khoan nguoi tra) va ma giao dich cong thanh toan (providerRef, ' +
    'providerTransactionNo, bankCode, bankTranNo, refundRef, responseCode) chi tra cho chinh khach cua don; KTV goi thi khong co.',
  properties: {
    id: { type: 'string' },
    method: { type: 'string', enum: ['CASH', 'ONLINE'] },
    status: { type: 'string', enum: ['UNPAID', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'], example: 'PAID' },
    amount: { type: 'string', description: 'So tien (chuoi so)', example: '2000' },
    provider: { type: 'string', nullable: true, example: 'PAYOS' },
    paidAt: { type: 'string', format: 'date-time', nullable: true },
    expiresAt: { type: 'string', format: 'date-time', nullable: true },
    payerBankName: { type: 'string', nullable: true, description: 'Chi khach cua don', example: 'TMCP Tien Phong' },
    payerAccountNumber: { type: 'string', nullable: true, description: 'Chi khach cua don' },
    payerAccountName: { type: 'string', nullable: true, description: 'Chi khach cua don' },
  },
};

/** Fields common to a booking in the customer's/technician's list and in its detail. */
const bookingSchema: SchemaObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    status: { type: 'string', enum: ['OPEN', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED'] },
    mode: { type: 'string', enum: ['HOME', 'ONSITE', 'ONLINE'] },
    assignmentMode: { type: 'string' },
    scheduledStart: { type: 'string', format: 'date-time' },
    scheduledEnd: { type: 'string', format: 'date-time' },
    items: { type: 'array', items: { type: 'object' } },
    totalAmount: { type: 'number' },
    paymentMethod: { type: 'string', nullable: true, enum: ['CASH', 'ONLINE'] },
    paymentStatus: { type: 'string', nullable: true, example: 'PAID' },
    paymentDeadlineAt: { type: 'string', format: 'date-time', nullable: true, description: 'Han thanh toan don truc tuyen' },
    awaitingPayment: { type: 'boolean', description: 'true = da co KTV nhan, khach chua thanh toan' },
    payment: paymentSchema,
    refund: refundSchema,
    cancellation: {
      type: 'object',
      nullable: true,
      properties: {
        reasonCode: { type: 'string', nullable: true },
        reasonText: { type: 'string', nullable: true },
        cancelledAt: { type: 'string', format: 'date-time', nullable: true },
        cancelledBy: { type: 'string', nullable: true, enum: ['CUSTOMER', 'TECHNICIAN', 'ADMIN'] },
      },
    },
  },
};

@ApiTags('Bookings')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService, private readonly complaintStorage: ComplaintStorageService) {}

  @Post('quote')
  @ApiCreatedResponse({ type: BookingQuoteResponse })
  @ApiOperation({ summary: 'Kiem tra lich, ma khuyen mai va tinh tong tien' })
  quote(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: QuoteBookingDto) {
    return this.bookings.quote(auth.sub, dto);
  }

  @Post()
  @ApiOperation({
    summary: 'Tao don voi KTV da duoc user chon',
    description:
      'Mobile goi POST /bookings/matching-technicians truoc de lay danh sach KTV. Sau khi user chon, gui technicianId vao endpoint nay de tao don.',
  })
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
  create(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: CreateUnifiedBookingDto) {
    // Mobile uses one booking flow. The backend always publishes the booking
    // to eligible technicians; clients do not choose DIRECT/OPEN_MARKETPLACE.
    if (dto.technicianId) return this.bookings.createSelectedFromCatalog(auth.sub, dto);
    return this.bookings.createOpen(auth.sub, dto as CreateOpenBookingDto);
  }

  @Post('matching-technicians')
  @ApiOperation({ summary: 'Tim KTV phu hop de user chon truoc khi dat lich' })
  matchingTechnicians(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: MatchTechniciansDto) {
    return this.bookings.matchingTechnicians(auth.sub, dto);
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
  @ApiOperation({
    summary: 'Danh sach lich cua khach hoac ky thuat vien',
    description: 'Moi don co cung cac truong nhu chi tiet don, gom `refund` (don cua chinh khach) va `payment` (payer* chi khach cua don thay).',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: bookingSchema },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  list(@CurrentAuth() auth: AccessTokenPayload, @Query() query: BookingHistoryQueryDto) {
    return this.bookings.listMine(auth.sub, query);
  }

  @Get('cancel-limit')
  @ApiOperation({
    summary: 'Tinh trang gioi han huy don va tam khoa cua toi (khach va KTV)',
    description:
      'Chi tinh don da co KTV nhan ma khach/KTV huy. remainingBeforeLock = 1 thi app nen canh bao truoc khi huy ' +
      '(lan toi bi tam khoa nextLockHours gio). lockedUntil khac null = dang tam khoa: van dang nhap duoc nhung dat don (khach) / ' +
      'nhan don (KTV) tra 409 ACCOUNT_SUSPENDED den thoi diem do.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        limit: { type: 'number', example: 3 },
        windowHours: { type: 'number', example: 24 },
        recentCancellations: { type: 'number', example: 2 },
        remainingBeforeLock: { type: 'number', nullable: true, example: 1 },
        lockedUntil: { type: 'string', format: 'date-time', nullable: true },
        suspension: {
          type: 'object',
          nullable: true,
          properties: { level: { type: 'number' }, reason: { type: 'string' }, source: { type: 'string', enum: ['CANCEL_LIMIT', 'ADMIN'] }, endsAt: { type: 'string', format: 'date-time' } },
        },
        nextLevel: { type: 'number', example: 2, description: 'Lan tam khoa tiep theo la lan thu may' },
        nextLockHours: { type: 'number', example: 24, description: 'Lan tam khoa tiep theo keo dai bao nhieu gio' },
      },
    },
  })
  cancelLimit(@CurrentAuth() auth: AccessTokenPayload) {
    return this.bookings.cancelLimit(auth.sub);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Chi tiet lich dat',
    description:
      'Khach, KTV cua don hoac admin. Don truc tuyen da thanh toan roi bi huy: `refund` co so tien hoan (chi khach thay). ' +
      'Tai khoan nguoi tra trong `payment` (payer*) chi tra cho khach cua don.',
  })
  @ApiOkResponse({ schema: bookingSchema })
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
        cancelLimit: { type: 'object', description: 'Giong GET /bookings/cancel-limit, sau lan huy nay' },
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
  @ApiCreatedResponse({ type: BookingReviewResponseDto })
  review(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.bookings.review(auth.sub, id, dto);
  }

  @Post(':id/complaint')
  @ApiOperation({
    summary: 'Khach hang hoac KTV cua don gui khieu nai',
    description: 'Moi ben (khach, KTV) khieu nai duoc 1 lan cho moi don. KTV dung reasonCode CUSTOMER_NO_SHOW, CUSTOMER_BEHAVIOR, PAYMENT_ISSUE, SAFETY_ISSUE, OTHER.',
  })
  @ApiCreatedResponse({ schema: { type: 'object', properties: { id: { type: 'string' }, bookingId: { type: 'string' }, reasonCode: { type: 'string' }, status: { type: 'string' } } } })
  complaint(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateComplaintDto,
  ) {
    return this.bookings.createComplaint(auth.sub, id, dto);
  }

  @Get(':id/complaint')
  @ApiOperation({
    summary: 'Xem khieu nai cua chinh minh (khach hoac KTV) + thong tin don cho dau khung chat ho tro',
    description: 'conversationId la chat rieng giua nguoi khieu nai va CSKH. 404 neu minh chua khieu nai don nay.',
  })
  customerComplaint(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.customerComplaint(auth.sub, id);
  }

  @Post(':id/complaint-evidence-upload-url')
  @ApiOperation({ summary: 'Tao URL upload anh minh chung khieu nai' })
  async complaintEvidenceUploadUrl(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: { contentType: string; size: number }) {
    await this.bookings.assertComplaintUploadAllowed(auth.sub, id);
    return this.complaintStorage.createUploadUrl(id, auth.sub, dto.contentType, dto.size);
  }
}
