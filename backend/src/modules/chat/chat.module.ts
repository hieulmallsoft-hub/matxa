import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatController } from './controllers/chat.controller';
import { ChatGateway } from './gateways/chat.gateway';
import { ChatStorageService } from './services/chat-storage.service';
import { ChatService } from './services/chat.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [ChatController],
  providers: [ChatService, ChatStorageService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
