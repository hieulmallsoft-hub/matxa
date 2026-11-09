import { VenueStorageService } from './venue-storage.service';

// The bucket only serves avatars publicly; venue images opened directly gave 403 and showed broken in admin and app.
describe('showing venue images from the private bucket', () => {
  const config: Record<string, string> = { S3_BUCKET: 'bucket', S3_REGION: 'ap-southeast-1', S3_ACCESS_KEY_ID: 'key', S3_SECRET_ACCESS_KEY: 'secret' };
  const storage = new VenueStorageService({ get: (key: string) => config[key] } as any);
  const stored = 'https://bucket.s3.ap-southeast-1.amazonaws.com/venues/6b293f93-2cd9-42d4-ad8f-3a00a9f1f240.png';

  it('signs our uploaded images and leaves outside URLs alone', async () => {
    const signed = await storage.viewUrl(stored);
    expect(signed).toContain('venues/6b293f93-2cd9-42d4-ad8f-3a00a9f1f240.png');
    expect(signed).toContain('X-Amz-Signature=');
    expect(signed).toContain('X-Amz-Expires=86400');
    await expect(storage.viewUrl('https://example.com/spa.jpg')).resolves.toBe('https://example.com/spa.jpg');
  });

  it('stores the plain URL when the admin saves a signed link back', () => {
    expect(storage.storedUrl(`${stored}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc`)).toBe(stored);
    expect(storage.storedUrl('https://example.com/spa.jpg')).toBe('https://example.com/spa.jpg');
  });
});
