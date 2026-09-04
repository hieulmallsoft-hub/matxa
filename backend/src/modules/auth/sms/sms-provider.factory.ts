import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DevelopmentSmsProvider } from './development-sms.provider';
import { SMS_PROVIDER, SmsProvider } from './sms-provider.interface';

export const smsProviderFactory: Provider = {
  provide: SMS_PROVIDER,
  inject: [ConfigService, DevelopmentSmsProvider],
  useFactory: (
    config: ConfigService,
    developmentProvider: DevelopmentSmsProvider,
  ): SmsProvider => {
    const provider = config.get<string>('SMS_PROVIDER', 'development');
    const environment = config.get<string>('NODE_ENV', 'development');

    if (provider === 'development' && environment !== 'production') {
      return developmentProvider;
    }

    if (provider === 'development') {
      throw new Error('SMS_PROVIDER=development khong duoc dung trong production');
    }

    throw new Error(`SMS provider "${provider}" chua duoc cai dat`);
  },
};
