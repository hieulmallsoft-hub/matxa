import { Module } from '@nestjs/common';
import { WalletController, AdminWalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({ controllers: [WalletController, AdminWalletController], providers: [WalletService], exports: [WalletService] })
export class WalletModule {}
