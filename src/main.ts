import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve uploaded images as static files: /images/xxx.jpg
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/',
  });
  const configService = app.get(ConfigService);

  // Global validation pipe for DTO validation and transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Graceful shutdown을 위한 shutdown hooks 활성화
  app.enableShutdownHooks();

  // CORS 설정 - 프론트엔드 origins 허용 (쉼표로 구분된 목록 지원)
  const frontendUrl = configService.get<string>('FRONTEND_URL') || '';
  const origins = frontendUrl.split(',').map((url) => url.trim()).filter(Boolean);

  app.enableCors({
    origin: origins.length === 1 ? origins[0] : origins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = configService.get<number>('PORT') || 3001;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
