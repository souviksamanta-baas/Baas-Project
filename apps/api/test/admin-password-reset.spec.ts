import { describe, expect, it } from 'vitest';

import { AdminPasswordResetService } from '../src/domains/admin/admin-password-reset.service';
import type { SupabaseService } from '../src/supabase/supabase.service';

type LookupCall = { column: string; table: string; value: string };

function buildService(calls: LookupCall[]): AdminPasswordResetService {
  const client = {
    auth: {
      admin: {
        generateLink: async () => ({ data: null, error: new Error('no-op') }),
      },
    },
    from: (table: string) => {
      if (table === 'nexolia_staff') {
        return {
          select: () => ({
            eq: (column: string, value: string) => {
              calls.push({ column, table, value });
              return {
                maybeSingle: async () => ({ data: null, error: null }),
              };
            },
          }),
        };
      }

      if (table === 'nexolia_staff_invites') {
        return {
          select: () => ({
            is: () => ({
              eq: (column: string, value: string) => {
                calls.push({ column, table, value });
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

  return new AdminPasswordResetService({
    getServiceRoleClient: () => client,
  } as unknown as SupabaseService);
}

describe('AdminPasswordResetService.requestReset', () => {
  it('runs staff / invite lookups as exact eq on the normalized email', async () => {
    const calls: LookupCall[] = [];
    const service = buildService(calls);

    await service.requestReset(' Staff@Nexolia.com.ar ');

    // Both lookups must use eq (not ilike) on a lowercased email.
    expect(calls).toEqual([
      { column: 'email', table: 'nexolia_staff', value: 'staff@nexolia.com.ar' },
      {
        column: 'email',
        table: 'nexolia_staff_invites',
        value: 'staff@nexolia.com.ar',
      },
    ]);
  });

  it('rejects wildcard mailboxes before touching the staff tables', async () => {
    const calls: LookupCall[] = [];
    const service = buildService(calls);

    await expect(service.requestReset('%@nexolia.com.ar')).rejects.toThrow(
      /correo válido/,
    );
    expect(calls).toEqual([]);

    await expect(service.requestReset('_staff@nexolia.com.ar')).rejects.toThrow(
      /correo válido/,
    );
    expect(calls).toEqual([]);
  });
});
