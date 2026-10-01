import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AddressesController, FavoritesController, LocationsController, MarketplaceController, TechnicianController } from './controllers/marketplace.controller';
import { MarketplaceService } from './services/marketplace.service';
import { AdminMarketplaceController } from './controllers/admin-marketplace.controller';
import { AdminMarketplaceService } from './services/admin-marketplace.service';
import { TechnicianApplicationsService } from './services/technician-applications.service';
import { TechnicianApplicationStorageService } from './services/technician-application-storage.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { LocationService } from './services/location.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [MarketplaceController, LocationsController, FavoritesController, TechnicianController, AddressesController, AdminMarketplaceController],
  providers: [MarketplaceService, AdminMarketplaceService, TechnicianApplicationsService, TechnicianApplicationStorageService, LocationService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
