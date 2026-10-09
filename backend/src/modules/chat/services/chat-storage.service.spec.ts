import { ConfigService } from '@nestjs/config';
import { ChatStorageService } from './chat-storage.service';

describe('ChatStorageService', () => {
  it('uses the AWS regional endpoint when S3_ENDPOINT is empty', async () => {
    const service = new ChatStorageService(
      new ConfigService({
        S3_BUCKET: 'matxa-test-bucket',
        S3_REGION: 'ap-southeast-1',
        S3_ACCESS_KEY_ID: 'test-access-key',
        S3_SECRET_ACCESS_KEY: 'test-secret-key',
        S3_ENDPOINT: '',
      }),
    );

    const result = await service.createUploadUrl('conversation-id', 'user-id', {
      fileName: 'photo.jpg',
      contentType: 'image/jpeg',
      size: 1024,
    });

    expect(result.mediaKey).toMatch(/^chat\/conversation-id\/user-id\/.+\.jpg$/);
    expect(new URL(result.uploadUrl).hostname).toContain('s3.ap-southeast-1.amazonaws.com');
  });
});
