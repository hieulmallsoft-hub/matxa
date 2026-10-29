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
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateVenueDto, UpdateVenueDto, VenueQueryDto } from '../dto/venue.dto';
import { VenueService } from '../services/venue.service';
import { VenueImageFile, VenueStorageService } from '../services/venue-storage.service';

@ApiTags('Venues')
@Controller('venues')
export class VenueController {
  constructor(private readonly venues: VenueService) {}
  @Get() list(@Query() query: VenueQueryDto) {
    return this.venues.list(query);
  }
  @Get(':id') detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.venues.detail(id);
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
  ) {}
  @Get() list(@Query() query: VenueQueryDto) {
    return this.venues.list(query, true);
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
