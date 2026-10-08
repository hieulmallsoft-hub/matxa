import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateServiceCatalogDto, ServiceCatalogQueryDto, UpdateServiceCatalogDto } from '../dto/service-catalog.dto';
import { ServiceCatalogService } from '../services/service-catalog.service';

@ApiTags('Service Catalog')
@Controller('service-catalog')
export class ServiceCatalogController {
  constructor(private readonly catalog: ServiceCatalogService) {}
  @Get()
  @ApiOperation({ summary: 'Mobile lay catalog dich vu dang hoat dong cho OPEN booking' })
  list(@Query() query: ServiceCatalogQueryDto) {
    return this.catalog.listPublic(query);
  }
}

@ApiTags('Admin Service Catalog')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/service-catalog')
export class AdminServiceCatalogController {
  constructor(private readonly catalog: ServiceCatalogService) {}
  @Get() list() {
    return this.catalog.listAdmin();
  }
  @Post() create(@Body() dto: CreateServiceCatalogDto) {
    return this.catalog.create(dto);
  }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServiceCatalogDto) {
    return this.catalog.update(id, dto);
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.deactivate(id);
  }
}
