import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AddressesController, FavoritesController, MarketplaceController, TechnicianController } from './controllers/marketplace.controller';
import { MarketplaceService } from './services/marketplace.service';
import { AdminMarketplaceController } from './controllers/admin-marketplace.controller';
import { AdminMarketplaceService } from './services/admin-marketplace.service';
import { TechnicianApplicationsService } from './services/technician-applications.service';
import { TechnicianApplicationStorageService } from './services/technician-application-storage.service';

@Module({
  imports: [AuthModule],
  controllers: [MarketplaceController, FavoritesController, TechnicianController, AddressesController, AdminMarketplaceController],
  providers: [MarketplaceService, AdminMarketplaceService, TechnicianApplicationsService, TechnicianApplicationStorageService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
