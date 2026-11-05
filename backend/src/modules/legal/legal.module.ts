import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminLegalController, LegalController } from './legal.controller';
import { LegalService } from './legal.service';

@Module({ imports: [AuthModule], controllers: [LegalController, AdminLegalController], providers: [LegalService] })
export class LegalModule {}
