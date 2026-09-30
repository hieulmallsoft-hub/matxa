import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { AdminMarketplaceService } from '../services/admin-marketplace.service';
import { TechnicianApplicationsService } from '../services/technician-applications.service';
import { AdminTechnicianApplicationQueryDto, RejectTechnicianApplicationDto } from '../dto/technician-application.dto';
import { AdminBookingsQueryDto, AdminPageDto, AdminUsersQueryDto, CreateBannerDto, CreateCategoryDto, CreatePromotionDto, CreateTechnicianByAdminDto, UpdateAdminTechnicianDto, UpdateBannerDto, UpdateCategoryDto, UpdatePromotionDto, UpdateUserStatusDto } from '../dto/marketplace.dto';

@ApiTags('Admin Marketplace')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/marketplace')
export class AdminMarketplaceController {
  constructor(private readonly admin: AdminMarketplaceService, private readonly applications: TechnicianApplicationsService) {}
  @Get('technician-applications') applicationsList(@Query() query: AdminTechnicianApplicationQueryDto) { return this.applications.list(query); }
  @Post('technician-applications/:id/approve') approveApplication(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) { return this.applications.approve(auth.sub, id); }
  @Post('technician-applications/:id/reject') rejectApplication(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectTechnicianApplicationDto) { return this.applications.reject(auth.sub, id, dto.reason); }
  @Get('dashboard') @ApiOperation({ summary: 'So lieu van hanh thuc te cho Admin dashboard' })
  dashboard() { return this.admin.dashboard(); }
  @Get('users') @ApiOperation({ summary: 'Danh sach user de tim va quan ly trang thai' })
  users(@Query() query: AdminUsersQueryDto) { return this.admin.users(query); }
  @Patch('users/:id/status') @ApiOperation({ summary: 'Khoa hoac mo khoa user' })
  userStatus(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserStatusDto) { return this.admin.updateUserStatus(auth.sub, id, dto); }
  @Get('bookings') @ApiOperation({ summary: 'Danh sach booking cho van hanh' })
  bookings(@Query() query: AdminBookingsQueryDto) { return this.admin.bookings(query); }
  @Get('technicians') @ApiOperation({ summary: 'Danh sach va trang thai ky thuat vien' })
  technicians(@Query() query: AdminPageDto) { return this.admin.technicians(query); }
  @Patch('technicians/:id') @ApiOperation({ summary: 'Cap nhat xac minh va ho so KTV' })
  updateTechnician(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAdminTechnicianDto) { return this.admin.updateTechnician(id, dto); }

  @Get('categories') @ApiOperation({ summary: 'Danh sach category ke ca inactive' })
  categories() { return this.admin.categories(); }
  @Post('categories') @ApiOperation({ summary: 'Admin tao danh muc dich vu' })
  category(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: CreateCategoryDto) { return this.admin.createCategory(auth.sub, dto); }
  @Patch('categories/:id') @ApiOperation({ summary: 'Sua hoac an category' })
  updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) { return this.admin.updateCategory(id, dto); }
  @Delete('categories/:id') @HttpCode(HttpStatus.NO_CONTENT) @ApiOperation({ summary: 'Ngung hien thi category an toan' })
  removeCategory(@Param('id', ParseUUIDPipe) id: string) { return this.admin.deactivateCategory(id); }

  @Get('banners') @ApiOperation({ summary: 'Danh sach banner ke ca inactive' })
  banners() { return this.admin.banners(); }
  @Post('banners') @ApiOperation({ summary: 'Admin tao banner trang chu' })
  banner(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: CreateBannerDto) { return this.admin.createBanner(auth.sub, dto); }
  @Patch('banners/:id') @ApiOperation({ summary: 'Sua hoac an banner' })
  updateBanner(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBannerDto) { return this.admin.updateBanner(id, dto); }
  @Delete('banners/:id') @HttpCode(HttpStatus.NO_CONTENT) @ApiOperation({ summary: 'Xoa banner' })
  removeBanner(@Param('id', ParseUUIDPipe) id: string) { return this.admin.removeBanner(id); }

  @Get('promotions') @ApiOperation({ summary: 'Danh sach voucher ke ca inactive' })
  promotions() { return this.admin.promotions(); }
  @Post('promotions') @ApiOperation({ summary: 'Admin tao ma khuyen mai' })
  promotion(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: CreatePromotionDto) { return this.admin.createPromotion(auth.sub, dto); }
  @Patch('promotions/:id') @ApiOperation({ summary: 'Sua hoac bat tat voucher' })
  updatePromotion(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePromotionDto) { return this.admin.updatePromotion(id, dto); }
  @Post('technicians') @ApiOperation({ summary: 'Admin chuyen user thanh ky thuat vien va tao ho so' })
  technician(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: CreateTechnicianByAdminDto) { return this.admin.createTechnician(auth.sub, dto); }
}
