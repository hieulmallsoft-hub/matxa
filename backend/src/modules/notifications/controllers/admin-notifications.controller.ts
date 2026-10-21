import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { UpdateNotificationTemplateDto } from '../dto/update-notification-template.dto';
import { NotificationsService } from '../services/notifications.service';

@ApiTags('Admin Notifications')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('templates')
  @ApiOperation({ summary: 'Danh sach mau noi dung thong bao' })
  list() {
    return this.notifications.listTemplates();
  }

  @Patch('templates/:type')
  @ApiOperation({ summary: 'Admin cap nhat noi dung thong bao theo ma su kien' })
  @ApiOkResponse({ schema: { type: 'object' } })
  update(@Param('type') type: string, @Body() dto: UpdateNotificationTemplateDto, @CurrentAuth() _auth: AccessTokenPayload) {
    return this.notifications.upsertTemplate(type, dto);
  }
}
