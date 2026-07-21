import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import type { Request, Response } from 'express';
import helmet from 'helmet';
import 'reflect-metadata';

import { AppModule } from './app.module';
import { createCorsOptions, getApiPort } from './config/api-config';
import { setupOpenApiDocs } from './docs/openapi';

function saveRawBody(request: Request, _response: Response, buffer: Buffer): void {
  if (buffer.length > 0) {
    (request as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const configService = app.get(ConfigService);

  app.set('trust proxy', 1);
  app.use(helmet());
  app.enableCors(createCorsOptions(configService));

  app.use(json({ limit: '12mb', verify: saveRawBody }));
  app.use(urlencoded({ extended: true, limit: '12mb', verify: saveRawBody }));

  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );

  setupOpenApiDocs(app, configService);

  const port = getApiPort(configService);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
