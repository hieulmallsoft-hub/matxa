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

@ApiTags('Technician Jobs')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('TECHNICIAN')
@Controller('technician/jobs')
export class TechnicianJobsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly cancellations: TechnicianBookingCancellationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'KTV xem don duoc giao trong tab Nhan viec' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              bookingId: { type: 'string' },
              bookingStatus: { type: 'string' },
              customer: {
                type: 'object',
                properties: {
                  displayName: { type: 'string', nullable: true },
                  gender: { type: 'string', nullable: true },
                  nationality: { type: 'string', nullable: true },
                  avatarUrl: { type: 'string', nullable: true },
                },
              },
              scheduledStart: { type: 'string', format: 'date-time' },
              scheduledEnd: { type: 'string', format: 'date-time' },
              items: { type: 'array', items: { type: 'object' } },
              canApply: { type: 'boolean' },
              canDecline: { type: 'boolean' },
            },
          },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  list(@CurrentAuth() auth: AccessTokenPayload, @Query() query: TechnicianJobQueryDto) {
    return this.bookings.listTechnicianJobs(auth.sub, query);
  }
  @Get(':id')
  @ApiOperation({ summary: 'KTV xem chi tiet don cua minh' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string' },
        bookingStatus: { type: 'string' },
        customer: { type: 'object' },
        scheduledStart: { type: 'string', format: 'date-time' },
        scheduledEnd: { type: 'string', format: 'date-time' },
        items: { type: 'array', items: { type: 'object' } },
        canApply: { type: 'boolean' },
        canContact: { type: 'boolean' },
      },
    },
  })
  detail(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.technicianJobDetail(auth.sub, id);
  }
  @Get(':id/contact')
  @ApiOperation({ summary: 'KTV lay so lien he cua khach sau khi da nhan don' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string' },
        displayName: { type: 'string', nullable: true },
        phoneNumber: { type: 'string' },
      },
    },
  })
  contact(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.technicianJobContact(auth.sub, id);
  }
  @Post(':id/cancellation-evidence-upload-url')
  @ApiOperation({ summary: 'Tao URL upload anh minh chung huy don private' })
  @ApiCreatedResponse({ schema: { type: 'object', additionalProperties: true, description: 'Presigned upload URL va media key' } })
  cancellationEvidenceUploadUrl(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TechnicianCancellationEvidenceUploadDto,
  ) {
    return this.cancellations.uploadUrl(auth.sub, id, dto);
  }
  @Post(':id/cancel')
  @ApiOperation({ summary: 'KTV assigned/SELECTED huy don, co ly do va anh minh chung neu bat buoc' })
  @ApiOkResponse({ schema: { type: 'object', additionalProperties: true, description: 'Don sau khi huy' } })
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
  @ApiOkResponse({ schema: { type: 'object', additionalProperties: true, description: 'Don sau khi rut ung tuyen' } })
  withdraw(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.withdrawOpenJobApplication(auth.sub, id);
  }
  @Post(':id/accept')
  @ApiOperation({ summary: 'KTV nhan don moi: PENDING sang CONFIRMED' })
  @ApiOkResponse({ schema: { type: 'object', additionalProperties: true, description: 'Don sau khi chap nhan' } })
  accept(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.acceptTechnicianJob(auth.sub, id);
  }
  @Post(':id/decline')
  @ApiOperation({ summary: 'KTV tu choi don moi va thong bao cho khach' })
  @ApiOkResponse({ schema: { type: 'object', additionalProperties: true, description: 'Don sau khi tu choi' } })
  decline(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookings.declineTechnicianJob(auth.sub, id, dto);
  }
  @Post(':id/complete')
  @ApiOperation({ summary: 'KTV hoan thanh don da nhan sau gio ket thuc' })
  @ApiOkResponse({ schema: { type: 'object', additionalProperties: true, description: 'Don sau khi hoan thanh' } })
  complete(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.completeTechnicianJob(auth.sub, id);
  }
}
