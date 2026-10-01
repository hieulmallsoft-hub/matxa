import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { AdminMarketplaceService } from '../services/admin-marketplace.service';
import { TechnicianApplicationsService } from '../services/technician-applications.service';
import { AdminTechnicianApplicationQueryDto, RejectTechnicianApplicationDto, ReviewTechnicianKycDto } from '../dto/technician-application.dto';
import { AdminBookingsQueryDto, AdminPageDto, AdminUsersQueryDto, CreateBannerDto, CreateCategoryDto, CreatePromotionDto, CreateTechnicianByAdminDto, UpdateAdminTechnicianDto, UpdateAdminTechnicianPriceOptionDto, UpdateBannerDto, UpdateCategoryDto, UpdatePromotionDto, UpdateUserStatusDto } from '../dto/marketplace.dto';

@ApiTags('Admin Marketplace')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/marketplace')
export class AdminMarketplaceController {
  constructor(private readonly admin: AdminMarketplaceService, private readonly applications: TechnicianApplicationsService) {}
  @Get('technician-applications') @ApiTags('Admin - Technician Applications') @ApiOperation({ summary: 'Danh sách hồ sơ KTV chờ duyệt', description: 'Admin lọc theo trạng thái và phân trang hồ sơ đăng ký.' }) applicationsList(@Query() query: AdminTechnicianApplicationQueryDto) { return this.applications.list(query); }
  @Post('technician-applications/:id/approve') @ApiTags('Admin - Technician Applications') @ApiOperation({ summary: 'Duyệt hồ sơ KTV', description: 'Chuyển user thành TECHNICIAN và tạo/kích hoạt TechnicianProfile.' }) approveApplication(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) { return this.applications.approve(auth.sub, id); }
  @Post('technician-applications/:id/reject') @ApiTags('Admin - Technician Applications') @ApiOperation({ summary: 'Từ chối hồ sơ KTV', description: 'Bắt buộc nhập lý do để Mobile hiển thị và chỉnh sửa hồ sơ.' }) rejectApplication(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectTechnicianApplicationDto) { return this.applications.reject(auth.sub, id, dto.reason); }
  @Get('technician-applications/:id') @ApiTags('Admin - Technician Applications') @ApiOperation({ summary: 'Chi tiet ho so va KYC private cua KTV' }) applicationDetail(@Param('id', ParseUUIDPipe) id: string) { return this.applications.detail(id); }
  @Post('technician-applications/:id/review') @ApiTags('Admin - Technician Applications') @ApiOperation({ summary: 'Nhan ho so vao trang thai dang review' }) reviewApplication(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) { return this.applications.startReview(auth.sub, id); }
  @Post('technician-applications/:id/kyc-review') @ApiTags('Admin - Technician Applications') @ApiOperation({ summary: 'Duyet hoac tu choi KYC cua ho so KTV' }) reviewKyc(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewTechnicianKycDto) { return this.applications.reviewKyc(auth.sub, id, dto.status, dto.reason); }
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
  @Get('technicians/:id/services') @ApiOperation({ summary: 'Danh sach dich vu va goi gia cua mot KTV de Admin dieu chinh gia' })
  technicianServices(@Param('id', ParseUUIDPipe) id: string) { return this.admin.technicianServices(id); }
  @Patch('technicians/:id/services/:serviceId/price-options/:optionId') @ApiOperation({ summary: 'Admin cap nhat gia mot goi dich vu cua KTV', description: 'Chi sua price. Thoi luong va code goi gia giu theo template da cau hinh.' })
  updateTechnicianPriceOption(@Param('id', ParseUUIDPipe) id: string, @Param('serviceId', ParseUUIDPipe) serviceId: string, @Param('optionId', ParseUUIDPipe) optionId: string, @Body() dto: UpdateAdminTechnicianPriceOptionDto) { return this.admin.updateTechnicianPriceOption(id, serviceId, optionId, dto); }

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
