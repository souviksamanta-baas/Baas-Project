import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import { createCorsOptions, getCorsAllowedOrigins } from '../src/config/api-config';
import { envValidationSchema } from '../src/config/env.validation';

describe('API config validation', () => {
  it('fails fast for missing production secrets', () => {
    const { error } = envValidationSchema.validate(
      {
        NODE_ENV: 'production',
      },
      {
        abortEarly: false,
        allowUnknown: true,
      },
    );

    expect(error?.message).toContain('SUPABASE_URL');
    expect(error?.message).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(error?.message).toContain('WHATSAPP_APP_SECRET');
    expect(error?.message).toContain('WHATSAPP_VERIFY_TOKEN');
    expect(error?.message).toContain('BAAS_TASKS_JOB_SECRET');
  });

  it('rejects wildcard CORS origins', () => {
    const { error } = envValidationSchema.validate(
      {
        BAAS_CORS_ALLOWED_ORIGINS: 'https://owner.example.com,*',
        NODE_ENV: 'development',
      },
      {
        abortEarly: false,
        allowUnknown: true,
      },
    );

    expect(error?.message).toContain('BAAS_CORS_ALLOWED_ORIGINS');
  });

  it('allows browser requests only from configured origins while permitting server clients', () => {
    const configService = {
      get: (key: string) =>
        key === 'BAAS_CORS_ALLOWED_ORIGINS'
          ? 'https://owner.example.com, http://localhost:3000'
          : undefined,
    } as unknown as ConfigService;
    const corsOptions = createCorsOptions(configService);
    const origin = corsOptions.origin as (
      requestOrigin: string | undefined,
      callback: (error: Error | null, allowed?: boolean) => void,
    ) => void;
    const callback = vi.fn();

    expect(getCorsAllowedOrigins(configService)).toEqual([
      'https://owner.example.com',
      'http://localhost:3000',
    ]);

    origin(undefined, callback);
    origin('https://owner.example.com', callback);
    origin('https://attacker.example.com', callback);

    expect(callback).toHaveBeenNthCalledWith(1, null, true);
    expect(callback).toHaveBeenNthCalledWith(2, null, true);
    expect(callback.mock.calls[2]?.[0]).toBeInstanceOf(Error);
    expect(callback.mock.calls[2]?.[1]).toBe(false);
  });
});
