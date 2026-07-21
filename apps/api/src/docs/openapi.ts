import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';

export const OPENAPI_DOCS_PATH = 'docs';
export const OPENAPI_JSON_PATH = 'docs/openapi.json';

export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Nexolia BaaS API')
    .setDescription(
      [
        'OpenAPI contract for the Nexolia Business-as-a-Service API.',
        'This contract is generated from the NestJS application and is the source of truth for REST API reference documentation.',
      ].join(' '),
    )
    .setVersion('0.1.0')
    .addServer('https://baas-project-production.up.railway.app', 'Production')
    .addServer('http://localhost:3000', 'Local development')
    .addBearerAuth(
      {
        bearerFormat: 'JWT',
        description: 'Supabase Auth access token used by owner-facing API endpoints.',
        scheme: 'bearer',
        type: 'http',
      },
      'SupabaseAuth',
    )
    .addApiKey(
      {
        description: 'Scheduler secret used to authorize operational maintenance jobs.',
        in: 'header',
        name: 'x-baas-job-secret',
        type: 'apiKey',
      },
      'BaasJobSecret',
    )
    .addApiKey(
      {
        description: 'Meta WhatsApp webhook HMAC signature header.',
        in: 'header',
        name: 'x-hub-signature-256',
        type: 'apiKey',
      },
      'WhatsAppSignature',
    )
    .addTag('Health', 'Service health and uptime checks.')
    .addTag('WhatsApp Webhooks', 'Inbound WhatsApp Business Cloud webhook verification and message delivery.')
    .addTag('AI', 'Owner-facing AI draft and Copi assistant actions.')
    .addTag('Tasks', 'Operational maintenance endpoints for follow-ups, alerts, and push notifications.')
    .build();

  return SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });
}

export function setupOpenApiDocs(app: INestApplication, configService?: ConfigService): void {
  const nodeEnv = configService?.get<string>('NODE_ENV') ?? process.env.NODE_ENV ?? 'development';
  const explicit = (configService?.get<string>('BAAS_ENABLE_OPENAPI_DOCS') ?? process.env.BAAS_ENABLE_OPENAPI_DOCS ?? '')
    .trim()
    .toLowerCase();
  const enabled =
    explicit === 'true' || explicit === '1' || (explicit === '' && nodeEnv !== 'production');

  if (!enabled) {
    return;
  }

  app.use(`/${OPENAPI_DOCS_PATH}`, (_request: Request, response: Response, next: NextFunction) => {
    response.removeHeader('Content-Security-Policy');
    next();
  });

  const document = createOpenApiDocument(app);

  SwaggerModule.setup(OPENAPI_DOCS_PATH, app, document, {
    customSiteTitle: 'Nexolia BaaS API Docs',
    jsonDocumentUrl: OPENAPI_JSON_PATH,
    swaggerOptions: {
      operationsSorter: 'alpha',
      persistAuthorization: true,
      tagsSorter: 'alpha',
    },
  });
}
