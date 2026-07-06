import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { CopiPolicyService } from './copi-policy.service';
import type { CopiFeatureFlags } from './copi.types';

const REPORT_RUNNERS: Record<
  string,
  (params: { businessCenterId: string; organizationId: string; parameters: Record<string, unknown> }) => Promise<Record<string, unknown>>
> = {
  low_stock_summary: async ({ businessCenterId, organizationId }) => {
    return { report: 'low_stock_summary', organizationId, businessCenterId };
  },
  sales_last_7_days: async ({ businessCenterId, organizationId }) => {
    return { report: 'sales_last_7_days', organizationId, businessCenterId };
  },
};

@Injectable()
export class CopiReportsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly policyService: CopiPolicyService,
  ) {}

  async saveDefinition(params: {
    businessCenterId: string;
    createdByUserId: string;
    name: string;
    organizationId: string;
    parameters: Record<string, unknown>;
    reportKey: string;
  }): Promise<{ id: string; name: string }> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('report_definitions')
      .insert({
        business_center_id: params.businessCenterId,
        created_by_user_id: params.createdByUserId,
        name: params.name,
        organization_id: params.organizationId,
        parameters: params.parameters,
        report_key: params.reportKey,
      })
      .select('id, name')
      .single<{ id: string; name: string }>();

    if (error) {
      throw new Error(`Failed to save report definition: ${error.message}`);
    }

    return data;
  }

  async runReport(params: {
    businessCenterId: string;
    featureFlags: CopiFeatureFlags;
    organizationId: string;
    parameters?: Record<string, unknown>;
    reportKey: string;
  }): Promise<Record<string, unknown>> {
    if (!this.policyService.canUseFeature(params.featureFlags, 'copi_custom_reports')) {
      throw new Error('Custom reports require the copi_custom_reports feature flag');
    }

    const runner = REPORT_RUNNERS[params.reportKey];
    if (!runner) {
      throw new Error(`Unsupported report key: ${params.reportKey}`);
    }

    return runner({
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
      parameters: params.parameters ?? {},
    });
  }
}
