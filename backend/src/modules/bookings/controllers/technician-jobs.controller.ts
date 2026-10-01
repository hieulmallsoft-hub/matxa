import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CancelBookingDto, TechnicianJobQueryDto } from '../dto/booking.dto';
import { BookingsService } from '../services/bookings.service';

@ApiTags('Technician Jobs')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('TECHNICIAN')
@Controller('technician/jobs')
export class TechnicianJobsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get() @ApiOperation({ summary: 'KTV xem don duoc giao trong tab Nhan viec' })
  list(@CurrentAuth() auth: AccessTokenPayload, @Query() query: TechnicianJobQueryDto) { return this.bookings.listTechnicianJobs(auth.sub, query); }
  @Get(':id') @ApiOperation({ summary: 'KTV xem chi tiet don cua minh' })
  detail(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.technicianJobDetail(auth.sub, id); }
  @Get(':id/contact') @ApiOperation({ summary: 'KTV lay so lien he cua khach sau khi da nhan don' })
  contact(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.technicianJobContact(auth.sub, id); }
  @Post(':id/accept') @ApiOperation({ summary: 'KTV nhan don moi: PENDING sang CONFIRMED' })
  accept(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.acceptTechnicianJob(auth.sub, id); }
  @Post(':id/decline') @ApiOperation({ summary: 'KTV tu choi don moi va thong bao cho khach' })
  decline(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelBookingDto) { return this.bookings.declineTechnicianJob(auth.sub, id, dto); }
  @Post(':id/complete') @ApiOperation({ summary: 'KTV hoan thanh don da nhan sau gio ket thuc' })
  complete(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.completeTechnicianJob(auth.sub, id); }
}
