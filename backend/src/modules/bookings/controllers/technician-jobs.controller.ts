import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CancelBookingDto, TechnicianCancellationEvidenceUploadDto, TechnicianCancelBookingDto, TechnicianJobQueryDto } from '../dto/booking.dto';
import { BookingsService } from '../services/bookings.service';
import { TechnicianBookingCancellationService } from '../services/technician-booking-cancellation.service';

@ApiTags('Technician Jobs')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('TECHNICIAN')
@Controller('technician/jobs')
export class TechnicianJobsController {
  constructor(private readonly bookings: BookingsService, private readonly cancellations: TechnicianBookingCancellationService) {}

  @Get() @ApiOperation({ summary: 'KTV xem don duoc giao trong tab Nhan viec' })
  list(@CurrentAuth() auth: AccessTokenPayload, @Query() query: TechnicianJobQueryDto) { return this.bookings.listTechnicianJobs(auth.sub, query); }
  @Get(':id') @ApiOperation({ summary: 'KTV xem chi tiet don cua minh' })
  detail(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.technicianJobDetail(auth.sub, id); }
  @Get(':id/contact') @ApiOperation({ summary: 'KTV lay so lien he cua khach sau khi da nhan don' })
  contact(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.technicianJobContact(auth.sub, id); }
  @Post(':id/cancellation-evidence-upload-url') @ApiOperation({ summary: 'Tao URL upload anh minh chung huy don private' })
  cancellationEvidenceUploadUrl(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TechnicianCancellationEvidenceUploadDto) { return this.cancellations.uploadUrl(auth.sub, id, dto); }
  @Post(':id/cancel') @ApiOperation({ summary: 'KTV assigned/SELECTED huy don, co ly do va anh minh chung neu bat buoc' })
  cancel(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TechnicianCancelBookingDto) { return this.cancellations.cancel(auth.sub, id, dto); }
  @Post(':id/apply') @ApiOperation({ summary: 'KTV ung tuyen don OPEN marketplace' })
  apply(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.applyToOpenJob(auth.sub, id); }
  @Post(':id/withdraw') @ApiOperation({ summary: 'KTV rut ung tuyen khi don con OPEN' })
  withdraw(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.withdrawOpenJobApplication(auth.sub, id); }
  @Post(':id/accept') @ApiOperation({ summary: 'KTV nhan don moi: PENDING sang CONFIRMED' })
  accept(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.acceptTechnicianJob(auth.sub, id); }
  @Post(':id/decline') @ApiOperation({ summary: 'KTV tu choi don moi va thong bao cho khach' })
  decline(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelBookingDto) { return this.bookings.declineTechnicianJob(auth.sub, id, dto); }
  @Post(':id/complete') @ApiOperation({ summary: 'KTV hoan thanh don da nhan sau gio ket thuc' })
  complete(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.completeTechnicianJob(auth.sub, id); }
}
