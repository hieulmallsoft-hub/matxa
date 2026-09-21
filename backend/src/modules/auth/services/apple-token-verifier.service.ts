import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createPublicKey, JsonWebKey, KeyObject, randomBytes } from 'node:crypto';
import { decode, JwtHeader, JwtPayload, verify } from 'jsonwebtoken';
import { RedisService } from '../../../redis/redis.service';

export interface AppleIdentity {
  subject: string;
  email?: string;
  emailVerified: boolean;
}

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URI = 'https://appleid.apple.com/auth/keys';

@Injectable()
export class AppleTokenVerifierService {
  private readonly signingKeys = new Map<string, KeyObject>();
  private keysExpireAt = 0;

  constructor(private readonly config: ConfigService, private readonly redis: RedisService) {}

  async startLogin(): Promise<{ nonce: string; expiresIn: number }> {
    if (!this.config.get<string>('APPLE_CLIENT_IDS')?.split(',').some((value) => value.trim())) {
      throw new ServiceUnavailableException('Apple Sign In chua duoc cau hinh');
    }
    const nonce = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(nonce).digest('hex');
    await this.redis.client.set(`auth:apple:nonce:${hash}`, '1', { EX: 300 });
    return { nonce, expiresIn: 300 };
  }

  async verify(idToken: string, rawNonce: string): Promise<AppleIdentity> {
    const audiences = this.config.get<string>('APPLE_CLIENT_IDS')
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (!audiences?.length) {
      throw new ServiceUnavailableException('Apple Sign In chua duoc cau hinh');
    }
    const [primaryAudience, ...additionalAudiences] = audiences;
    const audience = additionalAudiences.length
      ? [primaryAudience, ...additionalAudiences] as [string, ...string[]]
      : primaryAudience;

    try {
      const decoded = decode(idToken, { complete: true });
      const header = decoded?.header as JwtHeader | undefined;
      if (!header?.kid || header.alg !== 'RS256') throw new Error('Apple token header khong hop le');

      const signingKey = await this.getSigningKey(header.kid);
      const payload = verify(idToken, signingKey, {
        algorithms: ['RS256'],
        issuer: APPLE_ISSUER,
        audience,
      }) as JwtPayload;
      if (typeof payload.sub !== 'string' || !payload.sub || typeof payload.exp !== 'number') {
        throw new Error('Apple token thieu subject hoac expiry');
      }

      const expectedNonce = createHash('sha256').update(rawNonce).digest('hex');
      if (payload.nonce !== expectedNonce) throw new Error('Apple nonce khong khop');
      // Atomic consumption prevents concurrent requests from reusing a challenge.
      if (await this.redis.client.getDel(`auth:apple:nonce:${expectedNonce}`) !== '1') {
        throw new Error('Apple nonce het han hoac da su dung');
      }

      return {
        subject: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      };
    } catch {
      throw new UnauthorizedException('Apple identity token khong hop le');
    }
  }

  private async getSigningKey(kid: string): Promise<KeyObject> {
    const cached = this.signingKeys.get(kid);
    if (cached && Date.now() < this.keysExpireAt) return cached;

    const response = await fetch(APPLE_JWKS_URI, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error('Khong lay duoc Apple JWKS');
    const body = await response.json() as {
      keys?: Array<JsonWebKey & { kid?: string; kty?: string }>;
    };
    if (!Array.isArray(body.keys)) throw new Error('Apple JWKS khong hop le');

    this.signingKeys.clear();
    for (const key of body.keys) {
      if (typeof key.kid !== 'string' || key.kty !== 'RSA') continue;
      this.signingKeys.set(key.kid, createPublicKey({ key, format: 'jwk' }));
    }
    this.keysExpireAt = Date.now() + 3_600_000;
    const signingKey = this.signingKeys.get(kid);
    if (!signingKey) throw new Error('Apple signing key khong ton tai');
    return signingKey;
  }
}
