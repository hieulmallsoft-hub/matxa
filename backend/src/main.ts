import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Matxa Backend API')
    .setDescription([
      'Tai lieu REST API cho mobile Matxa.',
      '',
      '**Quy uoc cho mobile**',
      '- Base URL la `/api`; toan bo request va response su dung JSON.',
      '- API co bieu tuong khoa can header `Authorization: Bearer <accessToken>`.',
      '- Lay `accessToken` va `refreshToken` tu API dang nhap; khi access token het han hay goi `POST /auth/refresh`.',
      '- Thoi gian gui len server dung ISO-8601 UTC, vi du `2026-09-21T09:00:00.000Z`.',
      '- Tai lieu OpenAPI de generate client: `/api/docs-json`.',
    ].join('\n'))
    .setVersion('1.0')
    .addTag('Authentication', 'Dang ky, dang nhap, OTP va phien dang nhap.')
    .addTag('Profile', 'Ho so va anh dai dien cua tai khoan dang nhap.')
    .addTag('Marketplace', 'Du lieu trang chu, tim kiem va xem ky thuat vien.')
    .addTag('Favorites', 'Danh sach ky thuat vien yeu thich cua tai khoan.')
    .addTag('Addresses', 'Dia chi cua khach dung khi dat dich vu tai nha.')
    .addTag('Technician Management', 'API chi cho tai khoan co vai tro TECHNICIAN.')
    .addTag('Bookings', 'Bao gia, dat lich, huy lich va danh gia.')
    .addTag('Chat', 'Chat 1-1; tai anh theo presigned URL S3.')
    .addTag('Notifications', 'Danh sach thong bao va dang ky Firebase Cloud Messaging.')
    .addTag('Admin Marketplace', 'API chi cho tai khoan co vai tro ADMIN.')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
  const swaggerDocument = () =>
    SwaggerModule.createDocument(app, swaggerConfig, {
      operationIdFactory: (controllerKey, methodKey) =>
        `${controllerKey}_${methodKey}`,
    });
  SwaggerModule.setup('docs', app, swaggerDocument, {
    useGlobalPrefix: true,
    customSiteTitle: 'Matxa API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      operationsSorter: 'alpha',
      tagsSorter: 'alpha',
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
