import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IdentityLinkService } from '../src/domains/auth/identity-link.service';
import type { PlatformEmailAuthService } from '../src/domains/auth/platform-email-auth.service';
import type { SupabaseService } from '../src/supabase/supabase.service';

type AuthUser = {
  email?: string | null;
  id: string;
  phone?: string | null;
  user_metadata?: Record<string, unknown>;
};

function buildClient(options: {
  authUser: AuthUser;
  donorUserId?: string | null;
  isStaff?: boolean;
  /** When false, caller has no organization_members row (pure staff stays blocked). */
  hasOrgMembership?: boolean;
  mergeError?: { message: string } | null;
  orgs?: Array<{ name: string; organization_id: string; role: string }>;
  purposeFilterAssert?: (purpose: string) => void;
}) {
  const updates: unknown[] = [];
  const inserts: unknown[] = [];
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const hasOrgMembership = options.hasOrgMembership ?? true;

  const client = {
    auth: {
      admin: {
        deleteUser: vi.fn(async () => ({ error: null })),
        getUserById: vi.fn(async (id: string) => ({
          data: {
            user: {
              ...options.authUser,
              id,
              email:
                id === options.authUser.id
                  ? options.authUser.email
                  : 'other@example.com',
              phone:
                id === options.authUser.id ? options.authUser.phone : '+5491111111111',
            },
          },
          error: null,
        })),
        signOut: vi.fn(async () => ({ error: null })),
        updateUserById: vi.fn(async (_id: string, payload: unknown) => {
          updates.push(payload);
          return { data: { user: options.authUser }, error: null };
        }),
      },
      getUser: vi.fn(async () => ({
        data: { user: options.authUser },
        error: null,
      })),
    },
    from: (table: string) => {
      if (table === 'nexolia_staff') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: options.isStaff ? { user_id: options.authUser.id } : null,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'organization_members') {
        const listResult = {
          data: (options.orgs ?? []).map((org) => ({
            organization_id: org.organization_id,
            organizations: { archived_at: null, name: org.name },
            role: org.role,
          })),
          error: null,
        };
        const membershipRow = hasOrgMembership
          ? { organization_id: options.orgs?.[0]?.organization_id ?? 'org-default' }
          : null;

        return {
          select: () => ({
            eq: () => {
              const chain = {
                limit: () => ({
                  maybeSingle: async () => ({ data: membershipRow, error: null }),
                }),
                then: (
                  resolve: (value: typeof listResult) => unknown,
                  reject?: (reason: unknown) => unknown,
                ) => Promise.resolve(listResult).then(resolve, reject),
              };
              return chain;
            },
          }),
        };
      }

      if (table === 'auth_identity_merge_challenges') {
        return {
          insert: async (row: unknown) => {
            inserts.push(row);
            return { error: null };
          },
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }

      if (table === 'auth_otp_challenges') {
        return {
          select: () => ({
            eq: (_col: string, value: string) => {
              if (_col === 'purpose') {
                options.purposeFilterAssert?.(value);
              }
              return {
                eq: () => ({
                  eq: () => ({
                    is: () => ({
                      order: () => ({
                        limit: () => ({
                          maybeSingle: async () => ({ data: null, error: null }),
                        }),
                      }),
                    }),
                  }),
                }),
              };
            },
          }),
        };
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ args, fn });
      if (fn === 'find_auth_user_id_by_email' || fn === 'find_auth_user_id_by_phone') {
        return { data: options.donorUserId ?? null, error: null };
      }
      if (fn === 'merge_auth_user') {
        return { data: { ok: true }, error: options.mergeError ?? null };
      }
      return { data: null, error: null };
    },
  };

  return { client, inserts, rpcCalls, updates };
}

describe('IdentityLinkService', () => {
  const keeper: AuthUser = {
    email: 'keeper@example.com',
    id: 'keeper-1',
    phone: null,
    user_metadata: {},
  };

  let emailAuth: {
    requestOtp: ReturnType<typeof vi.fn>;
    verifyOtp: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    emailAuth = {
      requestOtp: vi.fn(async () => undefined),
      verifyOtp: vi.fn(async () => true),
    };
  });

  function serviceFor(options: Parameters<typeof buildClient>[0]): {
    service: IdentityLinkService;
    client: ReturnType<typeof buildClient>['client'];
    inserts: unknown[];
    rpcCalls: ReturnType<typeof buildClient>['rpcCalls'];
    updates: unknown[];
  } {
    const built = buildClient(options);
    const supabaseService = {
      createEphemeralServiceRoleClient: () => ({
        auth: {
          signInWithOtp: vi.fn(async () => ({ error: null })),
          signOut: vi.fn(async () => ({ error: null })),
          verifyOtp: vi.fn(async () => ({
            data: { user: { id: 'donor-sms', phone: '+5491100000000' } },
            error: null,
          })),
        },
      }),
      getServiceRoleClient: () => built.client,
    } as unknown as SupabaseService;

    const service = new IdentityLinkService(
      supabaseService,
      emailAuth as unknown as PlatformEmailAuthService,
    );

    return { ...built, service };
  }

  it('rejects pure nexolia_staff without a negocio', async () => {
    const { service } = serviceFor({
      authUser: keeper,
      hasOrgMembership: false,
      isStaff: true,
    });
    await expect(service.getMe('Bearer tok')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows dual-hat staff who already own a negocio', async () => {
    const { service } = serviceFor({
      authUser: keeper,
      hasOrgMembership: true,
      isStaff: true,
    });
    await expect(service.getMe('Bearer tok')).resolves.toMatchObject({
      email: 'keeper@example.com',
      emailVerified: true,
    });
  });

  it('requests email link OTP with purpose=link and does not enumerate', async () => {
    const phoneKeeper: AuthUser = {
      email: '54911@auth.nexolia.app',
      id: 'keeper-phone',
      phone: '+5491100000000',
      user_metadata: { auth_phone: '+5491100000000' },
    };
    const { service } = serviceFor({ authUser: phoneKeeper });
    await expect(
      service.requestEmailLink('Bearer tok', 'new@example.com'),
    ).resolves.toEqual({ ok: true });
    expect(emailAuth.requestOtp).toHaveBeenCalledWith('new@example.com', 'link');
  });

  it('attaches unused email without minting a session', async () => {
    const phoneKeeper: AuthUser = {
      email: '54911@auth.nexolia.app',
      id: 'keeper-phone',
      phone: '+5491100000000',
      user_metadata: { auth_phone: '+5491100000000' },
    };
    const { service, updates, rpcCalls } = serviceFor({
      authUser: phoneKeeper,
      donorUserId: null,
    });

    const result = await service.verifyEmailLink('Bearer tok', {
      code: '123456',
      email: 'new@example.com',
    });

    expect(emailAuth.verifyOtp).toHaveBeenCalledWith({
      code: '123456',
      email: 'new@example.com',
      purpose: 'link',
    });
    expect(result).toMatchObject({ status: 'linked' });
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('tokenHash');
    expect(updates.length).toBeGreaterThan(0);
    expect(rpcCalls.some((c) => c.fn === 'merge_auth_user')).toBe(false);
  });

  it('returns merge preview when another user owns the identity', async () => {
    const phoneKeeper: AuthUser = {
      email: '54911@auth.nexolia.app',
      id: 'keeper-phone',
      phone: '+5491100000000',
      user_metadata: { auth_phone: '+5491100000000' },
    };
    const { service, inserts } = serviceFor({
      authUser: phoneKeeper,
      donorUserId: 'donor-1',
      orgs: [{ name: 'Café Norte', organization_id: 'org-1', role: 'owner' }],
    });

    const result = await service.verifyEmailLink('Bearer tok', {
      code: '123456',
      email: 'donor@example.com',
    });

    expect(result.status).toBe('merge_required');
    if (result.status === 'merge_required') {
      expect(result.organizations).toEqual([
        { name: 'Café Norte', organizationId: 'org-1', role: 'owner' },
      ]);
      expect(result.mergeToken.length).toBeGreaterThan(16);
      expect(result.warning).toMatch(/dejará de existir/i);
    }
    expect(inserts.length).toBe(1);
  });

  it('rejects linking a different email when one is already verified', async () => {
    const { service } = serviceFor({ authUser: keeper });
    await expect(
      service.requestEmailLink('Bearer tok', 'other@example.com'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid OTP with UnauthorizedException path via false verify', async () => {
    emailAuth.verifyOtp = vi.fn(async () => false);
    const phoneKeeper: AuthUser = {
      email: '54911@auth.nexolia.app',
      id: 'keeper-phone',
      phone: '+5491100000000',
      user_metadata: { auth_phone: '+5491100000000' },
    };
    const { service } = serviceFor({ authUser: phoneKeeper });
    await expect(
      service.verifyEmailLink('Bearer tok', { code: '000000', email: 'x@example.com' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
