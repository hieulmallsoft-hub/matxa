import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationItem {
  @ApiProperty() id!: string;
  @ApiProperty() type!: string;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiPropertyOptional() actionUrl?: string;
  @ApiPropertyOptional() readAt?: Date;
  @ApiProperty() createdAt!: Date;
}

export class NotificationListResponse {
  @ApiProperty({ type: [NotificationItem] }) items!: NotificationItem[];
  @ApiProperty() unreadCount!: number;
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export class DeviceTokenResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['ANDROID', 'IOS'] }) platform!: string;
  @ApiPropertyOptional() deviceId?: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() lastSeenAt!: Date;
}

export class PushResultResponse {
  @ApiProperty() notificationId!: string;
  @ApiProperty() deviceCount!: number;
  @ApiProperty() successCount!: number;
  @ApiProperty() failureCount!: number;
}
