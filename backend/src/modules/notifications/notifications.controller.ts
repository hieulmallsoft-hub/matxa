import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { AccessTokenPayload } from '../auth/models/access-token-payload.model';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { RegisterDeviceTokenDto, RemoveDeviceTokenDto } from './dto/register-device-token.dto';
import { TestPushDto } from './dto/test-push.dto';
import { DeviceTokenResponse, NotificationItem, NotificationListResponse, PushResultResponse } from './models/notification.model';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('devices')
  @ApiOperation({ summary: 'Dang ky FCM token cua thiet bi dang nhap' })
  @ApiCreatedResponse({ type: DeviceTokenResponse })
  registerDevice(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: RegisterDeviceTokenDto) {
    return this.notifications.registerDevice(auth.sub, dto);
  }

  @Delete('devices')
  @ApiOperation({ summary: 'Go FCM token khi dang xuat khoi thiet bi' })
  removeDevice(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: RemoveDeviceTokenDto) {
    return this.notifications.removeDevice(auth.sub, dto.token);
  }

  @Post('test-push')
  @ApiOperation({ summary: 'Gui push thu den cac thiet bi cua tai khoan hien tai' })
  @ApiCreatedResponse({ type: PushResultResponse })
  testPush(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: TestPushDto) {
    return this.notifications.sendTestPush(auth.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lay danh sach thong bao cua tai khoan' })
  @ApiOkResponse({ type: NotificationListResponse })
  list(@CurrentAuth() auth: AccessTokenPayload, @Query() query: ListNotificationsDto) {
    return this.notifications.list(auth.sub, query);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Danh dau tat ca thong bao da doc' })
  markAllRead(@CurrentAuth() auth: AccessTokenPayload) {
    return this.notifications.markAllRead(auth.sub);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Danh dau mot thong bao da doc' })
  @ApiOkResponse({ type: NotificationItem })
  markRead(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(auth.sub, id);
  }

  @Delete()
  @ApiOperation({ summary: 'Xoa tat ca thong bao' })
  removeAll(@CurrentAuth() auth: AccessTokenPayload) {
    return this.notifications.removeAll(auth.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoa mot thong bao' })
  @ApiNoContentResponse()
  remove(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.remove(auth.sub, id);
  }
}
