import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  assertOrgMembership,
  assertUsersAreOrgMembers,
  extractBearerToken,
} from '../src/auth/request-auth.helper';
import type { SupabaseService } from '../src/supabase/supabase.service';

function asSupabase(client: unknown): SupabaseService {
  return { getServiceRoleClient: () => client } as unknown as SupabaseService;
}

describe('extractBearerToken', () => {
  it('requires a bearer token', () => {
    expect(() => extractBearerToken(undefined)).toThrow(UnauthorizedException);
    expect(extractBearerToken('Bearer abc')).toBe('abc');
  });
});

describe('assertOrgMembership', () => {
  it('allows members and rejects outsiders', async () => {
    const memberClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { role: 'staff' }, error: null }),
            }),
          }),
        }),
      }),
    };
    await expect(
      assertOrgMembership({
        organizationId: 'org-1',
        supabaseService: asSupabase(memberClient),
        userId: 'user-1',
      }),
    ).resolves.toBe('staff');

    const outsiderClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    };
    await expect(
      assertOrgMembership({
        organizationId: 'org-1',
        supabaseService: asSupabase(outsiderClient),
        userId: 'user-2',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('assertUsersAreOrgMembers', () => {
  it('rejects when any listed user is outside the organization', async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            in: async () => ({
              data: [{ user_id: 'user-1' }],
              error: null,
            }),
          }),
        }),
      }),
    };

    await expect(
      assertUsersAreOrgMembers({
        organizationId: 'org-1',
        supabaseService: asSupabase(client),
        userIds: ['user-1', 'user-2'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows when every listed user is a member', async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            in: async () => ({
              data: [{ user_id: 'user-1' }, { user_id: 'user-2' }],
              error: null,
            }),
          }),
        }),
      }),
    };

    await expect(
      assertUsersAreOrgMembers({
        organizationId: 'org-1',
        supabaseService: asSupabase(client),
        userIds: ['user-1', 'user-2'],
      }),
    ).resolves.toBeUndefined();
  });
});
