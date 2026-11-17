import { describe, expect, it } from 'vitest';

import { RegisteredOwnerClaimService } from '../src/domains/admin/registered-owner-claim.service';
import type { SupabaseService } from '../src/supabase/supabase.service';

type OwnerLookupCall = { column: string; value: string };

function buildService(ownerLookups: OwnerLookupCall[]): RegisteredOwnerClaimService {
  const client = {
    auth: {
      admin: {
        generateLink: async () => ({ data: null, error: new Error('no-op') }),
      },
    },
    from: (table: string) => {
      if (table === 'registered_owners') {
        return {
          select: () => ({
            eq: async (column: string, value: string) => {
              ownerLookups.push({ column, value });
              return { data: [], error: null };
            },
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  return new RegisteredOwnerClaimService({
    getServiceRoleClient: () => client,
  } as unknown as SupabaseService);
}

describe('RegisteredOwnerClaimService.claimOwnerByEmail', () => {
  it('matches registered owners by exact lowercased email', async () => {
    const lookups: OwnerLookupCall[] = [];
    const service = buildService(lookups);

    await service.claimOwnerByEmail(' Owner@Example.com ');

    expect(lookups).toEqual([{ column: 'email', value: 'owner@example.com' }]);
  });

  it('never runs the owner lookup when the login email contains SQL LIKE wildcards', async () => {
    const lookups: OwnerLookupCall[] = [];
    const service = buildService(lookups);

    await service.claimOwnerByEmail('%@example.com');
    await service.claimOwnerByEmail('_test@example.com');

    // A wildcard mailbox must not be able to claim ownership of any org.
    expect(lookups).toEqual([]);
  });
});
