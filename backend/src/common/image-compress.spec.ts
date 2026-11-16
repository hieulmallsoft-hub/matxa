import sharp = require('sharp');
import { compressImage } from './image-compress';

it('shrinks a large picture to WebP at most the given width, without enlarging small ones', async () => {
  // A noisy 2600x1800 PNG, like an exported photo.
  const raw = Buffer.alloc(2600 * 1800 * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 7919) % 251;
  const big = await sharp(raw, { raw: { width: 2600, height: 1800, channels: 3 } }).png().toBuffer();
  const out = await compressImage(big, 1280);
  const meta = await sharp(out.buffer).metadata();
  expect(out).toMatchObject({ contentType: 'image/webp', ext: 'webp' });
  expect(meta).toMatchObject({ format: 'webp', width: 1280, height: 886 });

  const small = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#2E7D4A' } }).png().toBuffer();
  expect((await sharp((await compressImage(small, 1280)).buffer).metadata()).width).toBe(400);
});
