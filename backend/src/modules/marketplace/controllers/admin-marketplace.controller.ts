import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { AdminMarketplaceService } from '../services/admin-marketplace.service';
import { CreateBannerDto, CreateCategoryDto, CreatePromotionDto, CreateTechnicianByAdminDto } from '../dto/marketplace.dto';

@ApiTags('Admin Marketplace')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('admin/marketplace')
export class AdminMarketplaceController {
  constructor(private readonly admin: AdminMarketplaceService) {}
  @Post('categories') @ApiOperation({ summary: 'Admin tao danh muc dich vu' })
  category(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: CreateCategoryDto) { return this.admin.createCategory(auth.sub, dto); }
  @Post('banners') @ApiOperation({ summary: 'Admin tao banner trang chu' })
  banner(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: CreateBannerDto) { return this.admin.createBanner(auth.sub, dto); }
  @Post('promotions') @ApiOperation({ summary: 'Admin tao ma khuyen mai' })
  promotion(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: CreatePromotionDto) { return this.admin.createPromotion(auth.sub, dto); }
  @Post('technicians') @ApiOperation({ summary: 'Admin chuyen user thanh ky thuat vien va tao ho so' })
  technician(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: CreateTechnicianByAdminDto) { return this.admin.createTechnician(auth.sub, dto); }
}
