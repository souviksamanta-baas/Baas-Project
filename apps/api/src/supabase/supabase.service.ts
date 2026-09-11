import { Injectable } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface SupabaseServiceConfig {
  url?: string;
  serviceRoleKey?: string;
}

@Injectable()
export class SupabaseService {
  private serviceRoleClient?: SupabaseClient;

  getServiceRoleClient(): SupabaseClient {
    if (this.serviceRoleClient) {
      return this.serviceRoleClient;
    }

    const config = this.requireConfig();
    this.serviceRoleClient = this.createServiceRoleClient(config);
    return this.serviceRoleClient;
  }

  /**
   * Short-lived client for operations that may attach a user session in-memory
   * (e.g. auth.verifyOtp). Never reuse this for the shared Nest singleton.
   */
  createEphemeralServiceRoleClient(): SupabaseClient {
    return this.createServiceRoleClient(this.requireConfig());
  }

  hasServiceRoleConfig(): boolean {
    const config = this.getConfig();
    return Boolean(config.url && config.serviceRoleKey);
  }

  private createServiceRoleClient(config: {
    url: string;
    serviceRoleKey: string;
  }): SupabaseClient {
    const { url, serviceRoleKey } = config;

    return createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        // Guard against accidental in-memory user sessions on this client:
        // supabase-js would otherwise send the user JWT on /rest/v1 and
        // PostgREST would run as `authenticated` (no grants on service-only tables).
        // Leave /auth/v1 alone so getUser(jwt) / verifyOtp keep working.
        fetch: (input, init) => {
          const requestUrl =
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.href
                : input.url;
          const headers = new Headers(init?.headers);
          headers.set('apikey', serviceRoleKey);
          if (
            requestUrl.includes('/rest/v1/') ||
            requestUrl.includes('/storage/v1/')
          ) {
            headers.set('Authorization', `Bearer ${serviceRoleKey}`);
          }
          return fetch(input, { ...init, headers });
        },
      },
    });
  }

  private requireConfig(): { url: string; serviceRoleKey: string } {
    const config = this.getConfig();
    if (!config.url || !config.serviceRoleKey) {
      throw new Error('Missing server-only Supabase service role configuration');
    }
    return { url: config.url, serviceRoleKey: config.serviceRoleKey };
  }

  private getConfig(): SupabaseServiceConfig {
    return {
      url: process.env.SUPABASE_URL,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
  }
}
