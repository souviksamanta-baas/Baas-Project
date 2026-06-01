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

    const config = this.getConfig();

    if (!config.url || !config.serviceRoleKey) {
      throw new Error('Missing server-only Supabase service role configuration');
    }

    this.serviceRoleClient = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    return this.serviceRoleClient;
  }

  hasServiceRoleConfig(): boolean {
    const config = this.getConfig();
    return Boolean(config.url && config.serviceRoleKey);
  }

  private getConfig(): SupabaseServiceConfig {
    return {
      url: process.env.SUPABASE_URL,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
  }
}
