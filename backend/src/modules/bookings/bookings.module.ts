import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsController } from './controllers/bookings.controller';
import { TechnicianJobsController } from './controllers/technician-jobs.controller';
import { BookingsService } from './services/bookings.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [BookingsController, TechnicianJobsController],
  providers: [BookingsService],
})
export class BookingsModule {}
