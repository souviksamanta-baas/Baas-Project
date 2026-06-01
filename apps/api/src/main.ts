import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import type { Request, Response } from 'express';
import 'reflect-metadata';

import { AppModule } from './app.module';

function saveRawBody(request: Request, _response: Response, buffer: Buffer): void {
  if (buffer.length > 0) {
    (request as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(json({ verify: saveRawBody }));
  app.use(urlencoded({ extended: true, verify: saveRawBody }));

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
