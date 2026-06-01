import { afterEach, describe, expect, it } from 'vitest';

import { SupabaseService } from '../src/supabase/supabase.service';

const originalEnv = { ...process.env };

describe('SupabaseService', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('reports service-role configuration as unavailable when secrets are missing', () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const service = new SupabaseService();

    expect(service.hasServiceRoleConfig()).toBe(false);
    expect(() => service.getServiceRoleClient()).toThrow('Missing server-only Supabase service role configuration');
  });

  it('creates a non-persisted service-role client when server env is configured', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature';

    const service = new SupabaseService();

    expect(service.hasServiceRoleConfig()).toBe(true);
    expect(service.getServiceRoleClient()).toBe(service.getServiceRoleClient());
  });
});
