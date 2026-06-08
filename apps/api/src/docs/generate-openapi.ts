import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { createOpenApiDocument } from './openapi';

async function main(): Promise<void> {
  process.env.NODE_ENV ??= 'development';

  const outputPath = resolve(process.cwd(), process.argv[2] ?? '../../docs/developer/openapi.json');
  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: false });
  const document = createOpenApiDocument(app);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown OpenAPI generation error';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
