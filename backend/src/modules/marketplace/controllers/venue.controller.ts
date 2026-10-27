import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateVenueDto, UpdateVenueDto, VenueQueryDto } from '../dto/venue.dto';
import { VenueService } from '../services/venue.service';

@ApiTags('Venues')
@Controller('venues')
export class VenueController {
  constructor(private readonly venues: VenueService) {}
  @Get() list(@Query() query: VenueQueryDto) { return this.venues.list(query); }
  @Get(':id') detail(@Param('id') id: string) { return this.venues.detail(id); }
}

@ApiTags('Admin Venues')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/venues')
export class AdminVenueController {
  constructor(private readonly venues: VenueService) {}
  @Get() list(@Query() query: VenueQueryDto) { return this.venues.list(query, true); }
  @Post() create(@Body() dto: CreateVenueDto) { return this.venues.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateVenueDto) { return this.venues.update(id, dto); }
}
