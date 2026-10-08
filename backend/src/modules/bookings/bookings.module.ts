import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsController } from './controllers/bookings.controller';
import { TechnicianJobsController } from './controllers/technician-jobs.controller';
import { BookingsService } from './services/bookings.service';
import { VnpayService } from './services/vnpay.service';
import { BookingCancellationStorageService } from './services/booking-cancellation-storage.service';
import { TechnicianBookingCancellationService } from './services/technician-booking-cancellation.service';
import { OpenBookingExpirationService } from './services/open-booking-expiration.service';
import { PlatformFeePolicyService } from './services/platform-fee-policy.service';
import { BookingVnpayController, VnpayController } from './controllers/vnpay.controller';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [BookingsController, TechnicianJobsController, VnpayController, BookingVnpayController],
  providers: [
    BookingsService,
    VnpayService,
    BookingCancellationStorageService,
    TechnicianBookingCancellationService,
    OpenBookingExpirationService,
    PlatformFeePolicyService,
  ],
})
export class BookingsModule {}
