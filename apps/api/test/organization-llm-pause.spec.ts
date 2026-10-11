import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OrganizationLlmCredentialsService } from '../src/domains/ai/organization-llm-credentials.service';
import type { OpenAiAdminClient } from '../src/domains/ai/openai-admin.client';
import type { SupabaseService } from '../src/supabase/supabase.service';

describe('OrganizationLlmCredentialsService pause gate', () => {
  const originalSharedKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-shared-fallback';
  });

  afterEach(() => {
    if (originalSharedKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalSharedKey;
    }
  });

  function buildService(orgRow: {
    archived_at: string | null;
    license_status: string;
  }): OrganizationLlmCredentialsService {
    const client = {
      from: (table: string) => {
        if (table === 'organizations') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: orgRow, error: null }),
              }),
            }),
          };
        }
        if (table === 'organization_llm_credentials') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      api_key_encrypted: 'encrypted',
                      status: 'active',
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    };

    const supabaseService = {
      getServiceRoleClient: () => client,
    } as unknown as SupabaseService;

    return new OrganizationLlmCredentialsService(
      supabaseService,
      {} as OpenAiAdminClient,
    );
  }

  it('returns null for paused orgs even when a shared OPENAI_API_KEY exists', async () => {
    const service = buildService({
      archived_at: null,
      license_status: 'paused',
    });
    await expect(service.getApiKeyForOrganization('org-1')).resolves.toBeNull();
  });

  it('returns null for archived orgs', async () => {
    const service = buildService({
      archived_at: '2026-10-11T00:00:00.000Z',
      license_status: 'active',
    });
    await expect(service.getApiKeyForOrganization('org-1')).resolves.toBeNull();
  });
});
