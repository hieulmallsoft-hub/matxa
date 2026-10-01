import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiExtraModels, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { AvailabilityQueryDto, CreateAddressDto, CreateAvailabilityDto, CreateTechnicianServiceDto, CreateTechnicianServicePriceOptionDto, MarketplaceHomeQueryDto, PromotionListQueryDto, SearchTechniciansDto, UpdateAddressDto, UpdateTechnicianServiceDto, UpdateTechnicianServicePriceOptionDto, UpsertTechnicianProfileDto } from '../dto/marketplace.dto';
import { MarketplaceService } from '../services/marketplace.service';
import { ComputedAvailabilityResponse, MarketplaceHomeResponse, MobilePromotionListResponse, TechnicianDetailResponse, TechnicianListItem, TechnicianListResponse, WorkingScheduleResponse } from '../entities/marketplace.entity';
import { OptionalAccessTokenGuard } from '../../auth/guards/optional-access-token.guard';
import { TechnicianApplicationsService } from '../services/technician-applications.service';
import { LocationService } from '../services/location.service';
import { AddTechnicianGalleryImageDto, TechnicianDocumentUploadDto, TechnicianGalleryUploadDto, UpdateTechnicianApplicationDto } from '../dto/technician-application.dto';

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

  @Get('promotions')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ type: MobilePromotionListResponse })
  @ApiOperation({ summary: 'Danh sach voucher dang hoat dong cho user hien tai' })
  promotions(@CurrentAuth() auth: AccessTokenPayload, @Query() query: PromotionListQueryDto) {
    return this.marketplace.promotions(auth.sub, query);
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

@ApiTags('Locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationService) {}
  @Get('cities') @ApiOperation({ summary: 'Danh sach thanh pho hoat dong' }) cities() { return this.locations.cities(); }
  @Get('cities/:cityCode/districts') @ApiOperation({ summary: 'Danh sach quan/huyen theo thanh pho' }) districts(@Param('cityCode') cityCode: string) { return this.locations.districts(cityCode); }
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

@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('technician')
export class TechnicianController {
  constructor(private readonly marketplace: MarketplaceService, private readonly applications: TechnicianApplicationsService) {}
  @Get('application')
  @ApiTags('Technician Application')
  @ApiOperation({ summary: 'Lấy hồ sơ đăng ký KTV của tài khoản hiện tại', description: 'Trả về hồ sơ DRAFT/PENDING/APPROVED/REJECTED. Không nhận userId từ Mobile.' })
  @ApiOkResponse({ description: 'Hồ sơ đăng ký hiện tại hoặc null nếu chưa tạo' })
  getApplication(@CurrentAuth() auth: AccessTokenPayload) { return this.applications.getMine(auth.sub); }
  @Post('application')
  @ApiTags('Technician Application')
  @ApiOperation({ summary: 'Tạo hồ sơ đăng ký KTV', description: 'Bước 1: tạo hồ sơ nháp. Sau đó upload đủ CCCD mặt trước, mặt sau và ảnh khuôn mặt.' })
  @ApiCreatedResponse({ description: 'Hồ sơ đã tạo ở trạng thái DRAFT' })
  createApplication(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: UpdateTechnicianApplicationDto) { return this.applications.createMine(auth.sub, dto); }
  @Patch('application')
  @ApiTags('Technician Application')
  @ApiOperation({ summary: 'Cập nhật hồ sơ đăng ký KTV', description: 'Chỉ cập nhật hồ sơ DRAFT hoặc REJECTED. Không thể sửa hồ sơ đang chờ duyệt hoặc đã được duyệt.' })
  @ApiOkResponse({ description: 'Hồ sơ sau khi cập nhật' })
  updateApplication(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: UpdateTechnicianApplicationDto) { return this.applications.updateMine(auth.sub, dto); }
  @Post('application/document-upload-url')
  @ApiTags('Technician Application')
  @ApiOperation({ summary: 'Tạo URL upload giấy tờ KTV', description: 'Bước 2: nhận presigned URL và PUT file trực tiếp lên S3 private. Không gửi base64 qua API.' })
  @ApiBody({ schema: { example: { documentType: 'ID_CARD_FRONT', contentType: 'image/jpeg', size: 250000 } } })
  @ApiCreatedResponse({ description: 'Presigned URL upload, mediaKey và thời hạn 300 giây' })
  documentUpload(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: TechnicianDocumentUploadDto) { return this.applications.uploadUrl(auth.sub, dto); }
  @Post('application/gallery-upload-url')
  @ApiTags('Technician Application')
  @ApiOperation({ summary: 'Tao URL upload anh gallery KTV private' })
  galleryUpload(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: TechnicianGalleryUploadDto) { return this.applications.galleryUploadUrl(auth.sub, dto); }
  @Post('application/gallery')
  @ApiTags('Technician Application')
  @ApiOperation({ summary: 'Luu anh gallery da upload, toi da 6 anh' })
  addGallery(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: AddTechnicianGalleryImageDto) { return this.applications.addGalleryImage(auth.sub, dto.storageKey, dto.sortOrder); }
  @Delete('application/gallery/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiTags('Technician Application')
  @ApiOperation({ summary: 'Xoa anh gallery cua chinh minh' })
  removeGallery(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) { return this.applications.removeGalleryImage(auth.sub, id); }
  @Post('application/submit')
  @ApiTags('Technician Application')
  @ApiOperation({ summary: 'Gửi hồ sơ KTV để Admin duyệt', description: 'Bước cuối: yêu cầu đủ thông tin và đủ 3 ảnh ID_CARD_FRONT, ID_CARD_BACK, FACE. Sau khi gửi, hồ sơ chuyển sang PENDING.' })
  @ApiOkResponse({ description: 'Hồ sơ đã chuyển sang PENDING' })
  submitApplication(@CurrentAuth() auth: AccessTokenPayload) { return this.applications.submit(auth.sub); }
  @Patch('profile') @ApiTags('Technician Management') @ApiOperation({ summary: 'Cap nhat ho so ky thuat vien cua minh' })
  profile(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: UpsertTechnicianProfileDto) { return this.marketplace.upsertMyProfile(auth.sub, dto); }
  @Post('services') @ApiTags('Technician Management') @ApiOperation({ summary: 'Them dich vu va bang gia' })
  service(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: CreateTechnicianServiceDto) { return this.marketplace.createMyService(auth.sub, dto); }
  @Patch('services/:id') @ApiTags('Technician Management') @ApiOperation({ summary: 'Sua dich vu va bang gia' })
  updateService(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTechnicianServiceDto) { return this.marketplace.updateMyService(auth.sub, id, dto); }
  @Get('services/:id/price-options') @ApiTags('Technician Management') @ApiOperation({ summary: 'Danh sach goi gia cua dich vu cua minh' })
  priceOptions(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) { return this.marketplace.listMyServicePriceOptions(auth.sub, id); }
  @Post('services/:id/price-options') @ApiTags('Technician Management') @ApiOperation({ summary: 'Them goi gia/thoi luong cho dich vu' })
  createPriceOption(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateTechnicianServicePriceOptionDto) { return this.marketplace.createMyServicePriceOption(auth.sub, id, dto); }
  @Patch('services/:id/price-options/:optionId') @ApiTags('Technician Management') @ApiOperation({ summary: 'Sua goi gia/thoi luong cua dich vu' })
  updatePriceOption(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Param('optionId', ParseUUIDPipe) optionId: string, @Body() dto: UpdateTechnicianServicePriceOptionDto) { return this.marketplace.updateMyServicePriceOption(auth.sub, id, optionId, dto); }
  @Delete('services/:id/price-options/:optionId') @HttpCode(HttpStatus.NO_CONTENT) @ApiTags('Technician Management') @ApiOperation({ summary: 'Xoa goi gia cua dich vu' })
  removePriceOption(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Param('optionId', ParseUUIDPipe) optionId: string) { return this.marketplace.removeMyServicePriceOption(auth.sub, id, optionId); }
  @Post('availability') @ApiTags('Technician Management') @ApiOperation({ summary: 'Them khung gio lam viec' })
  availability(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: CreateAvailabilityDto) { return this.marketplace.createAvailability(auth.sub, dto); }
  @Delete('availability/:id') @HttpCode(HttpStatus.NO_CONTENT) @ApiTags('Technician Management') @ApiOperation({ summary: 'Xoa khung gio lam viec' })
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
