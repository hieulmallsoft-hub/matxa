import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CopyObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ProfileStorageService } from './profile-storage.service';

describe('ProfileStorageService', () => {
  const service = new ProfileStorageService(new ConfigService({ S3_BUCKET: 'test', S3_REGION: 'us-east-1',
    S3_ACCESS_KEY_ID: 'test', S3_SECRET_ACCESS_KEY: 'test' }));
  let send: jest.SpyInstance;
  beforeEach(() => { send = jest.spyOn(S3Client.prototype, 'send'); });
  afterEach(() => jest.restoreAllMocks());

  it('copies a validated upload to a unique saved key with an ETag condition', async () => {
    send.mockResolvedValueOnce({ ContentType: 'image/png', ContentLength: 100, ETag: 'etag' }).mockResolvedValueOnce({});
    const key = await service.prepareAvatar('user', 'avatars/user/source.png');
    expect(key).toMatch(/^avatars\/user\/saved\/.+\.png$/);
    expect(send.mock.calls[1][0]).toBeInstanceOf(CopyObjectCommand);
    expect(send.mock.calls[1][0].input).toMatchObject({ Key: key, CopySourceIfMatch: 'etag' });
  });

  it.each([{ ContentType: 'text/html', ContentLength: 100 },
    { ContentType: 'image/png', ContentLength: 0 },
    { ContentType: 'image/png', ContentLength: 5242881 }])('rejects invalid metadata: %j', async metadata => {
    send.mockResolvedValueOnce(metadata);
    await expect(service.prepareAvatar('user', 'key')).rejects.toBeInstanceOf(BadRequestException);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each([404, 412, 403, 500])('maps S3 error %i without leaking credentials', async status => {
    send.mockRejectedValueOnce({ $metadata: { httpStatusCode: status } });
    await expect(service.prepareAvatar('user', 'key')).rejects.toBeInstanceOf(
      status === 404 || status === 412 ? BadRequestException : ServiceUnavailableException);
  });

  it('never deletes another user key', async () => {
    await service.deleteAvatar('user', 'avatars/other/file.png');
    expect(send).not.toHaveBeenCalled();
    send.mockResolvedValueOnce({});
    await service.deleteAvatar('user', 'avatars/user/file.png');
    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
  });
});
