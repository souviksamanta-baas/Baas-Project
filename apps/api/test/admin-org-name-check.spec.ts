import { BadRequestException } from '@nestjs/common';
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
              eq: async () => ({ data: [], error: null }),
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
    const ownerLookupCalls: string[] = [];
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
                eq: async (_column: string, value: string) => {
                  ownerLookupCalls.push(value);
                  return value === 'owner@example.com'
                    ? {
                        data: [
                          { organization_id: 'org-1', email: 'owner@example.com' },
                        ],
                        error: null,
                      }
                    : { data: [], error: null };
                },
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

    // Owner lookup must run as an exact `eq` on the normalized email.
    expect(ownerLookupCalls).toEqual(['owner@example.com']);
  });

  it('rejects org-name probes that contain LIKE wildcards', async () => {
    const service = serviceWithOrgs([{ id: 'org-1', name: 'Ferretería Villalba' }]);

    await expect(service.checkOrgName({ name: 'Ferretería%' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.checkOrgName({ name: 'Ferretería_Villalba' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('does not claim an existing org when the login email is a SQL LIKE wildcard', async () => {
    const ownerLookupCalls: string[] = [];
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
                eq: async (_column: string, value: string) => {
                  ownerLookupCalls.push(value);
                  return { data: [], error: null };
                },
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

    // `%@example.com` would have matched every owner under ilike. With the
    // normalized exact-match path we refuse to even run the owner lookup.
    await expect(
      service.checkOrgName({ email: '%@example.com', name: 'Ferretería Villalba' }),
    ).resolves.toEqual({
      available: true,
      ownedByRequester: false,
      orgName: 'Ferretería Villalba',
    });

    expect(ownerLookupCalls).toEqual([]);
  });
});
