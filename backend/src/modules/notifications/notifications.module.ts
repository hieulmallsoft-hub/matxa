import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './controllers/notifications.controller';
import { AdminNotificationsController } from './controllers/admin-notifications.controller';
import { NotificationsService } from './services/notifications.service';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController, AdminNotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
