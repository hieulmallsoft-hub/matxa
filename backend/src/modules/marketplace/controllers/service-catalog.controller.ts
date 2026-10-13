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
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          category: { type: 'object' },
          modes: { type: 'array', items: { type: 'string' } },
          pricingTemplate: { type: 'string' },
          priceOptions: { type: 'array', items: { type: 'object' } },
        },
      },
    },
  })
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
  @Get()
  @ApiOkResponse({ schema: { type: 'array', items: { type: 'object' } } })
  list() {
    return this.catalog.listAdmin();
  }
  @Post()
  @ApiCreatedResponse({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        isActive: { type: 'boolean' },
        priceOptions: { type: 'array', items: { type: 'object' } },
      },
    },
  })
  create(@Body() dto: CreateServiceCatalogDto) {
    return this.catalog.create(dto);
  }
  @Patch(':id')
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { id: { type: 'string' }, name: { type: 'string' }, isActive: { type: 'boolean' } },
    },
  })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServiceCatalogDto) {
    return this.catalog.update(id, dto);
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.deactivate(id);
  }
}
