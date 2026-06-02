import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';

export interface OrganizationSummary {
  id: string;
  name: string;
  timezone: string;
}

@Injectable()
export class OrganizationsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getOrganizationById(organizationId: string): Promise<OrganizationSummary | null> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('organizations')
      .select('id, name, timezone')
      .eq('id', organizationId)
      .maybeSingle<OrganizationSummary>();

    if (error) {
      throw new Error(`Failed to load organization: ${error.message}`);
    }

    return data;
  }
}
