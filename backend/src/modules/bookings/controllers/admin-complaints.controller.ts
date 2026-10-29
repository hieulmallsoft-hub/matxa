import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { BookingsService } from '../services/bookings.service';

@ApiTags('Admin Complaints')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/complaints')
export class AdminComplaintsController {
  constructor(private readonly bookings: BookingsService) {}
  @Get() list(@Query('status') status?: string) { return this.bookings.listComplaints(status); }
  @Patch(':id/status') update(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: { status: 'IN_REVIEW' | 'RESOLVED' | 'REJECTED' }) { return this.bookings.updateComplaintStatus(auth.sub, id, body.status); }
}
