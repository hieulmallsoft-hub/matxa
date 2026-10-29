import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsController } from './controllers/bookings.controller';
import { TechnicianJobsController } from './controllers/technician-jobs.controller';
import { BookingsService } from './services/bookings.service';
import { VnpayService } from './services/vnpay.service';
import { BookingCancellationStorageService } from './services/booking-cancellation-storage.service';
import { TechnicianBookingCancellationService } from './services/technician-booking-cancellation.service';
import { OpenBookingExpirationService } from './services/open-booking-expiration.service';
import { BookingAutoCompletionService } from './services/booking-auto-completion.service';
import { PlatformFeePolicyService } from './services/platform-fee-policy.service';
import { BookingVnpayController, VnpayController } from './controllers/vnpay.controller';
import { BookingPayosController, PayosWebhookController } from './controllers/payos.controller';
import { PayosService } from './services/payos.service';
import { SettingsModule } from '../settings/settings.module';
import { ComplaintStorageService } from './services/complaint-storage.service';
import { AdminComplaintsController } from './controllers/admin-complaints.controller';

@Module({
  imports: [AuthModule, NotificationsModule, MarketplaceModule, SettingsModule],
  controllers: [
    BookingsController,
    TechnicianJobsController,
    VnpayController,
    BookingVnpayController,
    PayosWebhookController,
    BookingPayosController,
    AdminComplaintsController,
  ],
  providers: [
    BookingsService,
    VnpayService,
    BookingCancellationStorageService,
    TechnicianBookingCancellationService,
    OpenBookingExpirationService,
    BookingAutoCompletionService,
    PlatformFeePolicyService,
    PayosService,
    ComplaintStorageService,
  ],
  exports: [PayosService],
})
export class BookingsModule {}
