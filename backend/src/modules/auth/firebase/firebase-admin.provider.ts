import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';

export const FIREBASE_ADMIN = Symbol('FIREBASE_ADMIN');

export const firebaseAdminProvider: Provider = {
  provide: FIREBASE_ADMIN,
  inject: [ConfigService],
  useFactory: (config: ConfigService): App => {
    const projectId = config.getOrThrow<string>('FIREBASE_PROJECT_ID');
    const clientEmail = config.getOrThrow<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = config
      .getOrThrow<string>('FIREBASE_PRIVATE_KEY')
      .replace(/\\n/g, '\n');

    return (
      getApps()[0] ??
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
    );
  },
};
