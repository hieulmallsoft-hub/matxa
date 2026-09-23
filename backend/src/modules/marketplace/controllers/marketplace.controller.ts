import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { AvailabilityQueryDto, CreateAddressDto, CreateAvailabilityDto, CreateTechnicianServiceDto, MarketplaceHomeQueryDto, SearchTechniciansDto, UpdateAddressDto, UpdateTechnicianServiceDto, UpsertTechnicianProfileDto } from '../dto/marketplace.dto';
import { MarketplaceService } from '../services/marketplace.service';
import { ComputedAvailabilityResponse, MarketplaceHomeResponse, TechnicianDetailResponse, TechnicianListItem, TechnicianListResponse, WorkingScheduleResponse } from '../entities/marketplace.entity';
import { OptionalAccessTokenGuard } from '../../auth/guards/optional-access-token.guard';

@ApiTags('Marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Get('home')
  @UseGuards(OptionalAccessTokenGuard)
  @ApiOkResponse({ type: MarketplaceHomeResponse })
  @ApiOperation({ summary: 'Du lieu trang chu: banner, danh muc va ky thuat vien' })
  home(@Query() query: MarketplaceHomeQueryDto, @CurrentAuth() auth?: AccessTokenPayload) {
    return this.marketplace.home(query.latitude, query.longitude, auth?.sub);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Danh sach danh muc dich vu' })
  categories() { return this.marketplace.categories(); }

  @Get('technicians')
  @UseGuards(OptionalAccessTokenGuard)
  @ApiOperation({ summary: 'Tim kiem va loc ky thuat vien' })
  @ApiOkResponse({ type: TechnicianListResponse })
  technicians(@Query() query: SearchTechniciansDto, @CurrentAuth() auth?: AccessTokenPayload) { return this.marketplace.searchTechnicians(query, auth?.sub); }

  @Get('technicians/:id')
  @UseGuards(OptionalAccessTokenGuard)
  @ApiOkResponse({ type: TechnicianDetailResponse })
  @ApiOperation({ summary: 'Chi tiet ky thuat vien, bang gia va danh gia' })
  technician(@Param('id', ParseUUIDPipe) id: string, @Query() location: MarketplaceHomeQueryDto, @CurrentAuth() auth?: AccessTokenPayload) {
    return this.marketplace.technicianDetail(id, location, auth?.sub);
  }

  @Get('technicians/:id/availability')
  @ApiExtraModels(ComputedAvailabilityResponse, WorkingScheduleResponse)
  @ApiOkResponse({ schema: { oneOf: [
    { $ref: getSchemaPath(ComputedAvailabilityResponse) },
    { type: 'array', items: { $ref: getSchemaPath(WorkingScheduleResponse) } },
  ] } })
  @ApiOperation({ summary: 'Khung gio kha dung cua ky thuat vien' })
  availability(@Param('id', ParseUUIDPipe) id: string, @Query() query: AvailabilityQueryDto) {
    return this.marketplace.availability(id, query);
  }
}

@ApiTags('Favorites')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly marketplace: MarketplaceService) {}
  @Get() @ApiOperation({ summary: 'Danh sach ky thuat vien yeu thich' })
  @ApiOkResponse({ type: [TechnicianListItem] })
  list(@CurrentAuth() auth: AccessTokenPayload) { return this.marketplace.favorites(auth.sub); }
  @Post(':technicianId') @ApiOperation({ summary: 'Them vao yeu thich' })
  add(@CurrentAuth() auth: AccessTokenPayload, @Param('technicianId', ParseUUIDPipe) id: string) { return this.marketplace.addFavorite(auth.sub, id); }
  @Delete(':technicianId') @HttpCode(HttpStatus.NO_CONTENT) @ApiNoContentResponse() @ApiOperation({ summary: 'Bo yeu thich' })
  remove(@CurrentAuth() auth: AccessTokenPayload, @Param('technicianId', ParseUUIDPipe) id: string) { return this.marketplace.removeFavorite(auth.sub, id); }
}

@ApiTags('Technician Management')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('technician')
export class TechnicianController {
  constructor(private readonly marketplace: MarketplaceService) {}
  @Patch('profile') @ApiOperation({ summary: 'Cap nhat ho so ky thuat vien cua minh' })
  profile(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: UpsertTechnicianProfileDto) { return this.marketplace.upsertMyProfile(auth.sub, dto); }
  @Post('services') @ApiOperation({ summary: 'Them dich vu va bang gia' })
  service(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: CreateTechnicianServiceDto) { return this.marketplace.createMyService(auth.sub, dto); }
  @Patch('services/:id') @ApiOperation({ summary: 'Sua dich vu va bang gia' })
  updateService(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTechnicianServiceDto) { return this.marketplace.updateMyService(auth.sub, id, dto); }
  @Post('availability') @ApiOperation({ summary: 'Them khung gio lam viec' })
  availability(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: CreateAvailabilityDto) { return this.marketplace.createAvailability(auth.sub, dto); }
  @Delete('availability/:id') @HttpCode(HttpStatus.NO_CONTENT) @ApiOperation({ summary: 'Xoa khung gio lam viec' })
  removeAvailability(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) { return this.marketplace.removeAvailability(auth.sub, id); }
}

@ApiTags('Addresses')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('addresses')
export class AddressesController {
  constructor(private readonly marketplace: MarketplaceService) {}
  @Get() @ApiOperation({ summary: 'Danh sach dia chi cua tai khoan' })
  list(@CurrentAuth() auth: AccessTokenPayload) { return this.marketplace.addresses(auth.sub); }
  @Post() @ApiOperation({ summary: 'Them dia chi' })
  create(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: CreateAddressDto) { return this.marketplace.createAddress(auth.sub, dto); }
  @Patch(':id') @ApiOperation({ summary: 'Sua dia chi' })
  update(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAddressDto) { return this.marketplace.updateAddress(auth.sub, id, dto); }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) @ApiOperation({ summary: 'Xoa dia chi' })
  remove(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) { return this.marketplace.removeAddress(auth.sub, id); }
}
