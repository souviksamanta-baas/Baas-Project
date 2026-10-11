import { describe, expect, it, vi } from 'vitest';

import { AdminOrgsService } from '../src/domains/admin/admin-orgs.service';
import type { OrganizationLlmCredentialsService } from '../src/domains/ai/organization-llm-credentials.service';
import type { OrganizationLifecycleService } from '../src/domains/organizations/organization-lifecycle.service';
import type { SupabaseService } from '../src/supabase/supabase.service';

vi.mock('../src/domains/admin/admin-auth.helper', () => ({
  assertNexoliaStaff: async () => ({
    email: 'staff@nexolia.com.ar',
    role: 'admin',
    user: {},
    userId: 'staff-1',
  }),
  requireSuperAdmin: () => undefined,
  writeAdminAudit: async () => undefined,
}));

describe('AdminOrgsService pause/resume', () => {
  it('stores prior license_status and sets paused', async () => {
    const updates: Record<string, unknown>[] = [];
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                archived_at: null,
                id: 'org-1',
                license_status: 'trial',
                license_status_before_pause: null,
                name: 'Demo',
              },
              error: null,
            }),
          }),
        }),
        update: (patch: Record<string, unknown>) => {
          updates.push(patch);
          return {
            eq: async () => ({ error: null }),
          };
        },
      }),
    };

    const service = new AdminOrgsService(
      { getServiceRoleClient: () => client } as unknown as SupabaseService,
      {} as OrganizationLifecycleService,
      {} as OrganizationLlmCredentialsService,
    );

    const result = await service.pauseOrganization({
      authorizationHeader: 'Bearer x',
      organizationId: 'org-1',
    });

    expect(result.status).toBe('paused');
    expect(updates[0]).toMatchObject({
      license_status: 'paused',
      license_status_before_pause: 'trial',
    });
  });

  it('restores license_status_before_pause on resume', async () => {
    const updates: Record<string, unknown>[] = [];
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                archived_at: null,
                id: 'org-1',
                license_status: 'paused',
                license_status_before_pause: 'trial',
                name: 'Demo',
              },
              error: null,
            }),
          }),
        }),
        update: (patch: Record<string, unknown>) => {
          updates.push(patch);
          return {
            eq: async () => ({ error: null }),
          };
        },
      }),
    };

    const service = new AdminOrgsService(
      { getServiceRoleClient: () => client } as unknown as SupabaseService,
      {} as OrganizationLifecycleService,
      {} as OrganizationLlmCredentialsService,
    );

    const result = await service.resumeOrganization({
      authorizationHeader: 'Bearer x',
      organizationId: 'org-1',
    });

    expect(result.status).toBe('trial');
    expect(updates[0]).toMatchObject({
      license_status: 'trial',
      license_status_before_pause: null,
    });
  });
});
