import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatUserModel {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() displayName?: string;
  @ApiPropertyOptional() avatarUrl?: string;
  @ApiPropertyOptional() role?: string;
}

export class MessageModel {
  @ApiProperty() id!: string;
  @ApiProperty() conversationId!: string;
  @ApiProperty() senderId!: string;
  @ApiPropertyOptional({ type: ChatUserModel }) sender?: ChatUserModel;
  @ApiProperty({ enum: ['TEXT', 'IMAGE', 'LOCATION', 'SYSTEM'] }) type!: string;
  @ApiPropertyOptional() text?: string;
  @ApiPropertyOptional() mediaUrl?: string;
  @ApiPropertyOptional() mediaKey?: string;
  @ApiPropertyOptional() latitude?: number;
  @ApiPropertyOptional() longitude?: number;
  @ApiPropertyOptional() address?: string;
  @ApiPropertyOptional() bookingId?: string;
  @ApiPropertyOptional() editedAt?: Date;
  @ApiPropertyOptional() recalledAt?: Date;
  @ApiPropertyOptional() deliveredAt?: Date;
  @ApiPropertyOptional() readAt?: Date;
  @ApiProperty() createdAt!: Date;
}

export class ConversationModel {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['BOOKING', 'SUPPORT', 'LEGACY'] }) type!: string;
  @ApiPropertyOptional({ nullable: true }) supportCustomerId?: string;
  @ApiPropertyOptional() bookingId?: string;
  @ApiProperty({ type: ChatUserModel }) participant!: ChatUserModel;
  @ApiPropertyOptional({ type: MessageModel }) lastMessage?: MessageModel;
  @ApiProperty() unreadCount!: number;
  @ApiPropertyOptional() lastMessageAt?: Date;
}

export class MessageListModel {
  @ApiProperty({ type: [MessageModel] }) items!: MessageModel[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export class UploadUrlModel {
  @ApiProperty() uploadUrl!: string;
  @ApiProperty() mediaUrl!: string;
  @ApiProperty() mediaKey!: string;
  @ApiProperty() expiresIn!: number;
}
