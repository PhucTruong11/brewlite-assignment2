import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { ipBlocklist, trustProxyHops } from './common/security/ip-blocklist.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // API chạy sau Vercel/Render nên phải tin proxy mới lấy đúng IP khách để giới hạn và chặn.
  app.set('trust proxy', trustProxyHops());
  app.use(ipBlocklist());
  app.use(cookieParser());

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`BrewLite API is running on: http://localhost:${port}/api`);
}
await bootstrap();