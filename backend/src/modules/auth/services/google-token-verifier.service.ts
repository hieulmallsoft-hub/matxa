import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleIdentity {
  subject: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

@Injectable()
export class GoogleTokenVerifierService {
  private readonly client = new OAuth2Client();
  private readonly clientId: string;

  constructor(config: ConfigService) {
    this.clientId = config.getOrThrow<string>('GOOGLE_CLIENT_ID');
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub) throw new Error('Google token khong co subject');

      return {
        subject: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified ?? false,
        name: payload.name,
        picture: payload.picture,
      };
    } catch {
      throw new UnauthorizedException('Google ID token khong hop le');
    }
  }
}
