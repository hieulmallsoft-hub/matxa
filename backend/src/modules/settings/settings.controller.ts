import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';

class UpdateCommissionDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  technicianSharePercent!: number;
}

@ApiTags('Admin Settings')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('commission')
  @ApiOperation({ summary: 'Lay ty le hoa hong KTV' })
  getCommission() { return this.settings.getCommission(); }

  @Patch('commission')
  @ApiOperation({ summary: 'Admin cap nhat ty le KTV nhan' })
  setCommission(@Body() dto: UpdateCommissionDto) { return this.settings.setCommission(dto.technicianSharePercent); }
}
