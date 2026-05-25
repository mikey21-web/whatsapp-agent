import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.set('trust proxy', 1);

  // Global request body size limit — prevents memory exhaustion from large payloads.
  // Webhook routes need a higher limit (raw body for HMAC) but are handled by
  // the body-parser middleware in AppModule.configure() which runs first.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.enableCors({
    origin: env.WEB_ORIGIN.split(','),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('diyaa.ai API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, doc);
  }

  await app.listen(env.PORT, '0.0.0.0');
  Logger.log(`API listening on :${env.PORT} (${env.NODE_ENV})`, 'Bootstrap');
}

void bootstrap();
