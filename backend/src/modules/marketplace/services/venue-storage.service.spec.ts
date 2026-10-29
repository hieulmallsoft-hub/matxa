import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { VenueStorageService } from './venue-storage.service';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  PutObjectCommand: jest.fn((input) => ({ input })),
}));

describe('venue image uploads', () => {
  const send = jest.fn();
  const destroy = jest.fn();
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const file = { buffer: png, mimetype: 'image/png', size: png.length };
  const config: Record<string, string> = {
    S3_BUCKET: 'bucket',
    S3_REGION: 'region',
    S3_ACCESS_KEY_ID: 'key',
    S3_SECRET_ACCESS_KEY: 'secret',
    S3_PUBLIC_BASE_URL: 'https://cdn.example.com',
  };
  const setup = (values = config) => new VenueStorageService({ get: (key: string) => values[key] } as any);
  beforeEach(() => {
    jest.clearAllMocks();
    (S3Client as jest.Mock).mockImplementation(() => ({ send, destroy }));
    send.mockResolvedValue({});
  });

  it('stores image bytes in S3 and returns a URL rather than Base64', async () => {
    const result = await setup().upload(file);
    expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({ Body: png, ContentType: 'image/png' }));
    expect(result.url).toMatch(/^https:\/\/cdn\.example\.com\/venues\/.+\.png$/);
    expect(destroy).toHaveBeenCalled();
  });
  it('reports missing S3 configuration while URL-based venues can still be saved', async () => {
    await expect(setup({}).upload(file)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it.each([
    undefined,
    { ...file, buffer: Buffer.from('not an image') },
    { ...file, buffer: Buffer.alloc(5 * 1024 * 1024 + 1) },
  ])('rejects missing, invalid or oversized image bytes', async (invalid) => {
    await expect(setup().upload(invalid as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });
  it('reports storage errors and closes the client', async () => {
    send.mockRejectedValue(new Error('offline'));
    await expect(setup().upload(file)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(destroy).toHaveBeenCalled();
  });
});
