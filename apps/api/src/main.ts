import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import type { NextFunction, Request, Response } from 'express';
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

  const largeJson = json({ limit: '12mb', verify: saveRawBody });
  const defaultJson = json({ limit: '256kb', verify: saveRawBody });
  const largeUrlencoded = urlencoded({ extended: true, limit: '12mb', verify: saveRawBody });
  const defaultUrlencoded = urlencoded({
    extended: true,
    limit: '256kb',
    verify: saveRawBody,
  });

  const usesLargeBody = (path: string): boolean =>
    path.startsWith('/webhooks') ||
    path.startsWith('/integrations/meta/') ||
    path.startsWith('/ai');

  app.use((request: Request, response: Response, next: NextFunction) => {
    const path = request.path || request.url || '';
    if (usesLargeBody(path)) {
      return largeJson(request, response, next);
    }
    return defaultJson(request, response, next);
  });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const path = request.path || request.url || '';
    if (usesLargeBody(path)) {
      return largeUrlencoded(request, response, next);
    }
    return defaultUrlencoded(request, response, next);
  });

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
