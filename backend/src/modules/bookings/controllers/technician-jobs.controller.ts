import { TechnicianJobActionResponseDto } from './bookings-response.dto';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import {
  CancelBookingDto,
  TechnicianCancellationEvidenceUploadDto,
  TechnicianCancelBookingDto,
  TechnicianJobQueryDto,
} from '../dto/booking.dto';
import { BookingsService } from '../services/bookings.service';
import { TechnicianBookingCancellationService } from '../services/technician-booking-cancellation.service';
import { technicianActivity } from '../services/technician-activity';
import { PrismaService } from '../../../database/prisma.service';

/** One technician job card / detail, as returned by both the list and the detail endpoint. */
const technicianJobSchema = {
  type: 'object',
  properties: {
    bookingId: { type: 'string' },
    bookingStatus: { type: 'string', enum: ['OPEN', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED'] },
    displayStatus: {
      type: 'string',
      enum: ['REQUESTED', 'NEW', 'APPLIED', 'NOT_SELECTED', 'UNAVAILABLE', 'CANCELLED', 'EXPIRED', 'DECLINED', 'WITHDRAWN', 'ACCEPTED', 'COMPLETED'],
      example: 'NEW',
      description: 'Nhãn thẻ theo Figma: REQUESTED=Khách đặt bạn, NEW=Yêu cầu mới, APPLIED=Đang chờ khách xác nhận, NOT_SELECTED=Không được chọn / đã có KTV khác nhận, ACCEPTED=Đã nhận, COMPLETED=Đã hoàn thành',
    },
    applicationStatus: { type: 'string', nullable: true, enum: ['APPLIED', 'SELECTED', 'NOT_SELECTED', 'WITHDRAWN', 'DECLINED', 'EXPIRED'] },
    requestedTechnicianId: { type: 'string', nullable: true, description: 'ID profile KTV khách yêu cầu ban đầu; khác KTV được gán cuối cùng.' },
    isRequestedTechnician: { type: 'boolean' },
    isSelected: { type: 'boolean', description: 'KTV duoc chot cuoi cung' },
    isApplicant: { type: 'boolean', description: 'KTV dang ung tuyen APPLIED' },
    customerSelectedAnotherTechnician: { type: 'boolean', description: 'Đơn đã có KTV khác nhận' },
    requestType: { type: 'string', enum: ['CUSTOMER_REQUEST', 'MARKETPLACE'] },
    requestLabel: { type: 'string', example: 'Khách đặt bạn' },
    customer: {
      type: 'object',
      properties: {
        displayName: { type: 'string', nullable: true },
        gender: { type: 'string', nullable: true, example: 'FEMALE' },
        nationality: { type: 'string', nullable: true, example: 'Việt Nam' },
        avatarUrl: { type: 'string', nullable: true },
      },
    },
    mode: { type: 'string', enum: ['HOME', 'ONSITE', 'ONLINE'] },
    addressText: {
      type: 'string', nullable: true, example: '52 Ngõ 15, Tổ 2A, Bạch Mai, Hai Bà Trưng, Hà Nội',
      description: 'Địa chỉ chi tiết (đơn tại nhà), có ngay khi KTV thấy đơn',
    },
    addressPreview: { type: 'string', nullable: true, example: '… Tổ 2A, Bạch Mai, Hai Bà Trưng, Hà Nội', description: 'Bản rút gọn bỏ số nhà' },
    district: { type: 'string', nullable: true, example: 'Hai Bà Trưng' },
    city: { type: 'string', nullable: true, example: 'Hà Nội' },
    distanceKm: { type: 'number', nullable: true, example: 5, description: 'Khoảng cách từ KTV tới khách; null khi chưa có vị trí' },
    address: {
      type: 'object', nullable: true,
      description: 'Có toạ độ để mở bản đồ; chỉ có sau khi KTV được nhận đơn',
      properties: { address: { type: 'string' }, latitude: { type: 'number' }, longitude: { type: 'number' } },
    },
    scheduledStart: { type: 'string', format: 'date-time' },
    scheduledEnd: { type: 'string', format: 'date-time' },
    applicationDeadlineAt: { type: 'string', format: 'date-time', nullable: true, description: 'Đếm ngược "12:05"' },
    paymentMethod: { type: 'string', example: 'CASH' },
    items: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, durationMinutes: { type: 'number' }, price: { type: 'number' } } },
    },
    totalAmount: { type: 'number', description: 'Tổng thu từ khách' },
    pricing: {
      type: 'object',
      properties: {
        grossServiceAmount: { type: 'number', example: 500000 },
        platformFee: { type: 'number', example: 125000, description: 'Gửi về Psyocore' },
        technicianEarning: { type: 'number', example: 375000, description: 'Bạn sẽ nhận được / Thực nhận' },
        isEstimate: { type: 'boolean', description: 'true = ước tính theo tỷ lệ hoa hồng hiện tại (chưa nhận đơn)' },
        currency: { type: 'string', example: 'VND' },
      },
    },
    canApply: { type: 'boolean' },
    canDecline: { type: 'boolean' },
    canWithdraw: { type: 'boolean' },
    canContact: { type: 'boolean' },
    canCancel: { type: 'boolean' },
    canComplete: { type: 'boolean' },
  },
};

@ApiTags('Technician Jobs')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('TECHNICIAN')
@Controller('technician/jobs')
export class TechnicianJobsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly cancellations: TechnicianBookingCancellationService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'KTV xem don duoc giao trong tab Nhan viec' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: technicianJobSchema },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  list(@CurrentAuth() auth: AccessTokenPayload, @Query() query: TechnicianJobQueryDto) {
    return this.bookings.listTechnicianJobs(auth.sub, query);
  }
  // Declared before ':id' so "activity" is not read as a booking id.
  @Get('activity')
  @ApiOperation({
    summary: 'Lich su hoat dong: so don, so khach, thu nhap hom nay / tuan nay / thang nay',
    description:
      'Tinh theo gio Viet Nam, tuan bat dau thu Hai, chi don COMPLETED (theo gio hen). earning = tien KTV nhan sau hoa hong, ' +
      'da gom phi di chuyen. recent = 20 don hoan thanh gan nhat.',
  })
  activity(@CurrentAuth() auth: AccessTokenPayload) {
    return technicianActivity(this.prisma, auth.sub);
  }
  @Get(':id')
  @ApiOperation({ summary: 'KTV xem chi tiet don cua minh' })
  @ApiOkResponse({ schema: technicianJobSchema as any })
  detail(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.technicianJobDetail(auth.sub, id);
  }
  @Get(':id/contact')
  @ApiOperation({
    summary: 'KTV lay so lien he cua khach sau khi da nhan don',
    description: 'Uu tien so dien thoai nhap kem dia chi cua don (source=ADDRESS), khong co thi so cua tai khoan (source=ACCOUNT)',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string' },
        displayName: { type: 'string', nullable: true },
        phoneNumber: { type: 'string' },
        source: { type: 'string', enum: ['ADDRESS', 'ACCOUNT'] },
      },
    },
  })
  contact(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.technicianJobContact(auth.sub, id);
  }
  @Post(':id/cancellation-evidence-upload-url')
  @ApiOperation({ summary: 'Tao URL upload anh minh chung huy don private' })
  @ApiCreatedResponse({ type: TechnicianJobActionResponseDto })
  cancellationEvidenceUploadUrl(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TechnicianCancellationEvidenceUploadDto,
  ) {
    return this.cancellations.uploadUrl(auth.sub, id, dto);
  }
  @Post(':id/cancel')
  @ApiOperation({ summary: 'KTV assigned/SELECTED huy don, co ly do va anh minh chung neu bat buoc' })
  @ApiOkResponse({ type: TechnicianJobActionResponseDto })
  cancel(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TechnicianCancelBookingDto,
  ) {
    return this.cancellations.cancel(auth.sub, id, dto);
  }
  @Post(':id/apply')
  @ApiOperation({ summary: 'KTV ung tuyen don OPEN marketplace' })
  @ApiCreatedResponse({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        bookingId: { type: 'string' },
        technicianProfileId: { type: 'string' },
        status: { type: 'string', example: 'APPLIED' },
        appliedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  apply(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.applyToOpenJob(auth.sub, id);
  }
  @Post(':id/withdraw')
  @ApiOperation({ summary: 'KTV rut ung tuyen khi don con OPEN' })
  @ApiOkResponse({ type: TechnicianJobActionResponseDto })
  withdraw(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.withdrawOpenJobApplication(auth.sub, id);
  }
  @Post(':id/accept')
  @ApiOperation({ summary: 'KTV nhan don moi: PENDING sang CONFIRMED' })
  @ApiOkResponse({ type: TechnicianJobActionResponseDto })
  accept(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.acceptTechnicianJob(auth.sub, id);
  }
  @Post(':id/decline')
  @ApiOperation({ summary: 'KTV tu choi don moi va thong bao cho khach' })
  @ApiOkResponse({ type: TechnicianJobActionResponseDto })
  decline(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookings.declineTechnicianJob(auth.sub, id, dto);
  }
  @Post(':id/complete')
  @ApiOperation({ summary: 'KTV hoan thanh don da nhan sau gio ket thuc' })
  @ApiOkResponse({ type: TechnicianJobActionResponseDto })
  complete(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.completeTechnicianJob(auth.sub, id);
  }
}
