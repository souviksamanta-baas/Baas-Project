import type { ConfigService } from '@nestjs/config';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export function getApiPort(configService: ConfigService): number {
  return Number(configService.get<number>('API_PORT') ?? configService.get<number>('PORT') ?? 3000);
}

export function getCorsAllowedOrigins(configService: ConfigService): string[] {
  const rawOrigins = configService.get<string>('BAAS_CORS_ALLOWED_ORIGINS') ?? '';
  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function createCorsOptions(configService: ConfigService): CorsOptions {
  const allowedOrigins = new Set(getCorsAllowedOrigins(configService));

  return {
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Baas-Job-Secret', 'X-Hub-Signature-256'],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin is not allowed: ${origin}`), false);
    },
  };
}

export function getRateLimitTtl(configService: ConfigService): number {
  return Number(configService.get<number>('BAAS_RATE_LIMIT_TTL_MS') ?? 60_000);
}

export function getRateLimitMax(configService: ConfigService): number {
  return Number(configService.get<number>('BAAS_RATE_LIMIT_MAX') ?? 300);
}

export function getWebhookRateLimitTtl(): number {
  return Number(process.env.BAAS_WEBHOOK_RATE_LIMIT_TTL_MS ?? 60_000);
}

export function getWebhookRateLimitMax(): number {
  return Number(process.env.BAAS_WEBHOOK_RATE_LIMIT_MAX ?? 120);
}
