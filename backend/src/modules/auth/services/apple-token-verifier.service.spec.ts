import { ConfigService } from '@nestjs/config';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { sign } from 'jsonwebtoken';
import { RedisService } from '../../../redis/redis.service';
import { AppleTokenVerifierService } from './apple-token-verifier.service';

describe('AppleTokenVerifierService', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const entries = new Map<string, string>();
  const redis = { client: {
    set: jest.fn(async (key: string, value: string) => { entries.set(key, value); return 'OK'; }),
    getDel: jest.fn(async (key: string) => {
      const value = entries.get(key) ?? null;
      entries.delete(key);
      return value;
    }),
  } };
  let service: AppleTokenVerifierService;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    entries.clear();
    jest.clearAllMocks();
    service = new AppleTokenVerifierService(
      { get: () => 'com.matxa.test' } as unknown as ConfigService,
      redis as unknown as RedisService,
    );
    fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'test-key' }] }),
    } as Response);
  });
  afterEach(() => fetchMock.mockRestore());

  function token(nonce: string, overrides: Record<string, unknown> = {}) {
    const payload: Record<string, unknown> = {
      sub: 'apple-user', iss: 'https://appleid.apple.com', aud: 'com.matxa.test',
      exp: Math.floor(Date.now() / 1000) + 300,
      nonce: createHash('sha256').update(nonce).digest('hex'),
      email: 'user@example.com', email_verified: 'true', ...overrides,
    };
    if (payload.exp === undefined) delete payload.exp;
    return sign(payload, privateKey, { algorithm: 'RS256', keyid: 'test-key' });
  }

  it('issues expiring challenges and allows only one concurrent login', async () => {
    const { nonce, expiresIn } = await service.startLogin();
    expect(expiresIn).toBe(300);
    expect(redis.client.set).toHaveBeenCalledWith(expect.any(String), '1', { EX: 300 });
    const signed = token(nonce);
    const results = await Promise.allSettled([service.verify(signed, nonce), service.verify(signed, nonce)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await expect(service.verify(signed, nonce)).rejects.toThrow();
  });

  it.each([
    ['audience', { aud: 'another-app' }],
    ['issuer', { iss: 'https://attacker.example' }],
    ['expiry', { exp: 1 }],
    ['missing expiry', { exp: undefined }],
    ['nonce', { nonce: 'incorrect' }],
  ])('rejects invalid %s without consuming the challenge', async (_label, overrides) => {
    const { nonce } = await service.startLogin();
    await expect(service.verify(token(nonce, overrides), nonce)).rejects.toThrow();
    expect(redis.client.getDel).not.toHaveBeenCalled();
    await expect(service.verify(token(nonce), nonce)).resolves.toMatchObject({ subject: 'apple-user', emailVerified: true });
  });

  it('rejects a token with a forged signature', async () => {
    const { nonce } = await service.startLogin();
    const parts = token(nonce).split('.');
    parts[2] = Buffer.alloc(256).toString('base64url');
    await expect(service.verify(parts.join('.'), nonce)).rejects.toThrow();
    expect(redis.client.getDel).not.toHaveBeenCalled();
  });

  it('rejects missing or expired challenges', async () => {
    await expect(service.verify(token('unknown'), 'unknown')).rejects.toThrow();
    const { nonce } = await service.startLogin();
    entries.clear();
    await expect(service.verify(token(nonce), nonce)).rejects.toThrow();
  });

  it('rejects missing configuration', async () => {
    service = new AppleTokenVerifierService({ get: () => '' } as unknown as ConfigService, redis as unknown as RedisService);
    await expect(service.startLogin()).rejects.toThrow('Apple Sign In chua duoc cau hinh');
    await expect(service.verify('token', 'nonce')).rejects.toThrow('Apple Sign In chua duoc cau hinh');
  });
});
