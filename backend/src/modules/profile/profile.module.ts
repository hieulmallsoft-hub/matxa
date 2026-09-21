import { Module } from '@nestjs/common';
import { ProfileController } from './controllers/profile.controller';
import { ProfileService } from './services/profile.service';
import { ProfileStorageService } from './services/profile-storage.service';

@Module({
  controllers: [ProfileController],
  providers: [ProfileService, ProfileStorageService],
})
export class ProfileModule {}
