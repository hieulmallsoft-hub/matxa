import { Module } from '@nestjs/common';
import { WalletController, AdminWalletController, WalletPayosWebhookController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { WalletTopupExpirationService } from './wallet-topup-expiration.service';
import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [AuthModule, BookingsModule],
  controllers: [WalletController, AdminWalletController, WalletPayosWebhookController],
  providers: [WalletService, WalletTopupExpirationService],
  exports: [WalletService],
})
export class WalletModule {}
