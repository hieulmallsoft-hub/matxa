import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { static as serveStatic } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  // Keep the operations portal on the API origin so browser requests do not
  // require a broad CORS policy.
  app.use('/admin', serveStatic(join(process.cwd(), '..', 'operations-web', 'dist')));
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Matxa API · Mobile & Operations')
    .setDescription([
      '# Matxa API Documentation',
      'Tài liệu tích hợp chính thức cho Mobile App và Operations Web.',
      '',
      '## Quy ước tích hợp',
      '- **Base URL:** `/api` · mọi request/response dùng JSON.',
      '- **Authentication:** API có biểu tượng khóa yêu cầu `Authorization: Bearer <accessToken>`.',
      '- **Token:** lấy từ API đăng nhập; khi hết hạn gọi `POST /auth/refresh`.',
      '- **Date & time:** gửi ISO-8601 có timezone, ưu tiên UTC `Z`.',
      '- **Validation:** request sai trả HTTP 400; không gửi field ngoài schema.',
      '- **OpenAPI JSON:** `/api/docs-json` để generate client.',
      '',
      '> Hãy bấm **Authorize** một lần để Swagger tự gắn access token cho các request cần đăng nhập.',
    ].join('\n'))
    .setVersion('1.0')
    .addTag('Authentication', 'Đăng ký, đăng nhập, OTP và phiên đăng nhập.')
    .addTag('Profile', 'Tài khoản, hồ sơ cá nhân và avatar.')
    .addTag('Marketplace', 'Trang chủ, danh mục, tìm kiếm và KTV.')
    .addTag('Technician Application', 'KTV đăng ký, upload CCCD/khuôn mặt và gửi duyệt.')
    .addTag('Bookings', 'Quote, đặt lịch, lịch sử, hủy lịch và đánh giá.')
    .addTag('Chat', 'Chat 1-1 REST và Socket.IO, upload ảnh S3.')
    .addTag('Notifications', 'Thông báo in-app và Firebase Cloud Messaging.')
    .addTag('Favorites', 'KTV yêu thích của tài khoản.')
    .addTag('Addresses', 'Địa chỉ dùng cho dịch vụ tại nhà.')
    .addTag('Technician Management', 'Dịch vụ, lịch làm việc và hồ sơ KTV đã duyệt.')
    .addTag('Admin - Technician Applications', 'Admin duyệt hồ sơ đăng ký KTV.')
    .addTag('Admin Marketplace', 'Admin quản lý user, banner, danh mục, voucher và booking.')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
  const swaggerDocument = () =>
    SwaggerModule.createDocument(app, swaggerConfig, {
      // Every operation is explicitly tagged. Disable Nest's controller-name tag
      // so Technician endpoints are not rendered a second time under "Technician".
      autoTagControllers: false,
      operationIdFactory: (controllerKey, methodKey) =>
        `${controllerKey}_${methodKey}`,
    });
  SwaggerModule.setup('docs', app, swaggerDocument, {
    useGlobalPrefix: true,
    customSiteTitle: 'Matxa API Docs',
    customfavIcon: 'https://swagger.io/favicon-32x32.png',
    customCss: `
      .swagger-ui .topbar { background: #123c2d; }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
      .swagger-ui .info h1 { color: #123c2d; font-size: 30px; }
      .swagger-ui .info .description { max-width: 920px; line-height: 1.65; }
      .swagger-ui .scheme-container { background: #f5f8f6; box-shadow: none; border-radius: 8px; }
      .swagger-ui .opblock-tag { border-bottom: 1px solid #dfe7e2; padding: 16px 10px; }
      .swagger-ui .opblock { border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
      .swagger-ui .btn.authorize { border-color: #197044; color: #197044; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      displayRequestDuration: true,
      tryItOutEnabled: false,
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 2,
      operationsSorter: 'method',
      tagsSorter: 'alpha',
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
