import { describe, expect, it } from 'vitest';

import { extractOrganizationId } from '../src/auth/org-membership.guard';
import type { AuthenticatedRequest } from '../src/auth/jwt-auth.guard';

function asRequest(partial: Partial<AuthenticatedRequest>): AuthenticatedRequest {
  return partial as AuthenticatedRequest;
}

describe('extractOrganizationId', () => {
  it('reads organizationId from params, then query, then body', () => {
    expect(
      extractOrganizationId(
        asRequest({
          params: { organizationId: ' from-params ' },
          query: { organizationId: 'from-query' },
          body: { organizationId: 'from-body' },
        }),
      ),
    ).toBe('from-params');

    expect(
      extractOrganizationId(
        asRequest({
          params: {},
          query: { organizationId: 'from-query' },
          body: { organizationId: 'from-body' },
        }),
      ),
    ).toBe('from-query');

    expect(
      extractOrganizationId(
        asRequest({
          params: {},
          query: {},
          body: { organizationId: 'from-body' },
        }),
      ),
    ).toBe('from-body');
  });

  it('returns undefined when organizationId is absent', () => {
    expect(extractOrganizationId(asRequest({ params: {}, query: {}, body: {} }))).toBeUndefined();
  });
});
