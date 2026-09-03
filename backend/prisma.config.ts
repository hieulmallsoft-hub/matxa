import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Generate khong can ket noi DB; runtime van bat buoc DATABASE_URL qua ConfigService.
    url:
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/matxa?schema=public',
  },
});
