import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminSettingsController, PublicSettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({ imports: [AuthModule], controllers: [AdminSettingsController, PublicSettingsController], providers: [SettingsService], exports: [SettingsService] })
export class SettingsModule {}
