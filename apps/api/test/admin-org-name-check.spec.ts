import { describe, expect, it } from 'vitest';

import { AdminLeadsService } from '../src/domains/admin/admin-leads.service';
import type { SupabaseService } from '../src/supabase/supabase.service';

function serviceWithOrgs(orgs: Array<{ id: string; name: string }>): AdminLeadsService {
  const client = {
    from: (table: string) => {
      if (table === 'organizations') {
        return {
          select: () => ({
            ilike: () => ({
              limit: async () => ({ data: orgs, error: null }),
            }),
          }),
        };
      }

      if (table === 'registered_owners') {
        return {
          select: () => ({
            in: () => ({
              ilike: async () => ({ data: [], error: null }),
            }),
          }),
        };
      }

      return {
        select: () => ({
          in: async () => ({ data: [], error: null }),
        }),
      };
    },
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: null } }),
      },
    },
  };

  return new AdminLeadsService({
    getServiceRoleClient: () => client,
  } as unknown as SupabaseService);
}

describe('AdminLeadsService.checkOrgName', () => {
  it('does not enumerate existing names without a matching owner/member email', async () => {
    const service = serviceWithOrgs([{ id: 'org-1', name: 'Ferretería Villalba' }]);

    await expect(service.checkOrgName({ name: 'Ferretería Villalba' })).resolves.toEqual({
      available: true,
      ownedByRequester: false,
      orgName: 'Ferretería Villalba',
    });

    await expect(
      service.checkOrgName({ email: 'other@example.com', name: 'Ferretería Villalba' }),
    ).resolves.toEqual({
      available: true,
      ownedByRequester: false,
      orgName: 'Ferretería Villalba',
    });
  });

  it('marks a name unavailable only for the matching owner email', async () => {
    const client = {
      from: (table: string) => {
        if (table === 'organizations') {
          return {
            select: () => ({
              ilike: () => ({
                limit: async () => ({
                  data: [{ id: 'org-1', name: 'Ferretería Villalba' }],
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === 'registered_owners') {
          return {
            select: () => ({
              in: () => ({
                ilike: async () => ({
                  data: [{ organization_id: 'org-1', email: 'owner@example.com' }],
                  error: null,
                }),
              }),
            }),
          };
        }

        return {
          select: () => ({
            in: async () => ({ data: [], error: null }),
          }),
        };
      },
      auth: {
        admin: {
          getUserById: async () => ({ data: { user: null } }),
        },
      },
    };
    const service = new AdminLeadsService({
      getServiceRoleClient: () => client,
    } as unknown as SupabaseService);

    await expect(
      service.checkOrgName({ email: 'owner@example.com', name: 'Ferretería Villalba' }),
    ).resolves.toEqual({
      available: false,
      ownedByRequester: true,
      orgName: 'Ferretería Villalba',
    });
  });
});
