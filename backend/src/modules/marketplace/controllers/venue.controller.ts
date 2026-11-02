import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import {
  CreateVenueDto,
  ModerateVenueReviewDto,
  UpdateVenueDto,
  UpsertVenueReviewDto,
  VenueQueryDto,
  VenueReviewQueryDto,
} from '../dto/venue.dto';
import { VenueService } from '../services/venue.service';
import { VenueReviewService } from '../services/venue-review.service';
import { VenueImageFile, VenueStorageService } from '../services/venue-storage.service';

@ApiTags('Venues')
@Controller('venues')
export class VenueController {
  constructor(
    private readonly venues: VenueService,
    private readonly reviews: VenueReviewService,
  ) {}
  @Get()
  @ApiOperation({ summary: 'Danh sach dia diem; truyen latitude/longitude de co distanceKm va sort=distance' })
  list(@Query() query: VenueQueryDto) {
    return this.venues.list(query);
  }
  @Get(':id')
  @ApiOperation({ summary: 'Chi tiet dia diem kem tong hop danh gia va 3 danh gia moi nhat' })
  async detail(@Param('id', ParseUUIDPipe) id: string, @Query() query: VenueQueryDto) {
    const venue = await this.venues.detail(id, query);
    const [reviewSummary, latestReviews] = await Promise.all([this.reviews.summary(id), this.reviews.latest(id)]);
    return { ...venue, reviewSummary, latestReviews };
  }
  @Get(':id/reviews')
  @ApiOperation({ summary: 'Tat ca danh gia (man "Xem tat ca"), loc theo so sao' })
  reviewList(@Param('id', ParseUUIDPipe) id: string, @Query() query: VenueReviewQueryDto) {
    return this.reviews.list(id, query);
  }
  @Get(':id/reviews/mine')
  @ApiBearerAuth('access-token')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Danh gia cua chinh khach cho dia diem nay; null neu chua danh gia' })
  myReview(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.reviews.mine(auth.sub, id);
  }
  @Post(':id/reviews')
  @ApiBearerAuth('access-token')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Khach danh gia 1-5 sao; gui lai se cap nhat danh gia cu' })
  review(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertVenueReviewDto) {
    return this.reviews.upsert(auth.sub, id, dto);
  }
}

@ApiTags('Admin Venues')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/venues')
export class AdminVenueController {
  constructor(
    private readonly venues: VenueService,
    private readonly storage: VenueStorageService,
    private readonly reviews: VenueReviewService,
  ) {}
  @Get() list(@Query() query: VenueQueryDto) {
    return this.venues.list(query, true);
  }
  @Get(':id/reviews')
  @ApiOperation({ summary: 'Admin xem tat ca danh gia, ke ca da an, kem ten that' })
  reviewList(@Param('id', ParseUUIDPipe) id: string, @Query() query: VenueReviewQueryDto) {
    return this.reviews.list(id, query, true);
  }
  @Patch('reviews/:reviewId')
  @ApiOperation({ summary: 'An hoac hien lai danh gia; diem trung binh duoc tinh lai' })
  moderateReview(@Param('reviewId', ParseUUIDPipe) reviewId: string, @Body() dto: ModerateVenueReviewDto) {
    return this.reviews.moderate(reviewId, dto.isHidden);
  }
  @Post('images')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  uploadImage(@UploadedFile() file: VenueImageFile) {
    return this.storage.upload(file);
  }
  @Post() create(@Body() dto: CreateVenueDto) {
    return this.venues.create(dto);
  }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVenueDto) {
    return this.venues.update(id, dto);
  }
  @Delete(':id') remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.venues.remove(id);
  }
}
