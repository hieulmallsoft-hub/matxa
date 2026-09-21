import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProfileController } from './controllers/profile.controller';
import { ProfileService } from './services/profile.service';
import { ProfileStorageService } from './services/profile-storage.service';

@Module({
  imports: [AuthModule],
  controllers: [ProfileController],
  providers: [ProfileService, ProfileStorageService],
})
export class ProfileModule {}
