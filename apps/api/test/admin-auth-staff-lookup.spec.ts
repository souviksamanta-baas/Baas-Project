import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { assertNexoliaStaff } from '../src/domains/admin/admin-auth.helper';
import type { SupabaseService } from '../src/supabase/supabase.service';

type InviteLookupArgs = { column: string; value: string };

function buildSupabaseService(params: {
  authEmail: string | null;
  inviteLookups: InviteLookupArgs[];
  staffRow?: { email: string; role: string } | null;
}): SupabaseService {
  const staffRow = params.staffRow ?? null;
  const client = {
    auth: {
      getUser: async (token: string) => {
        if (!token) {
          return { data: { user: null }, error: new Error('no token') };
        }
        return {
          data: {
            user: {
              email: params.authEmail,
              id: 'user-under-test',
            },
          },
          error: null,
        };
      },
    },
    from: (table: string) => {
      if (table === 'nexolia_staff') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: staffRow, error: null }),
            }),
          }),
        };
      }

      if (table === 'nexolia_staff_invites') {
        return {
          select: () => ({
            is: () => ({
              eq: (column: string, value: string) => {
                params.inviteLookups.push({ column, value });
                return {
                  maybeSingle: async () => ({ data: null, error: null }),
                };
              },
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  return {
    getServiceRoleClient: () => client,
  } as unknown as SupabaseService;
}

describe('assertNexoliaStaff', () => {
  it('rejects the sign-in without ever running an invite lookup when the login email is a wildcard', async () => {
    const inviteLookups: InviteLookupArgs[] = [];
    const supabase = buildSupabaseService({
      authEmail: '%@nexolia.com.ar',
      inviteLookups,
    });

    await expect(
      assertNexoliaStaff(supabase, 'Bearer irrelevant'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Wildcard mailbox must never match a pending invite.
    expect(inviteLookups).toEqual([]);
  });

  it('looks up invites with an exact eq on the normalized email', async () => {
    const inviteLookups: InviteLookupArgs[] = [];
    const supabase = buildSupabaseService({
      authEmail: 'Staff@Nexolia.com.ar',
      inviteLookups,
    });

    await expect(
      assertNexoliaStaff(supabase, 'Bearer irrelevant'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(inviteLookups).toEqual([
      { column: 'email', value: 'staff@nexolia.com.ar' },
    ]);
  });
});
