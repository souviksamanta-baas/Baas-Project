import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthSessionService } from '../src/domains/auth/auth-session.service';
import type { SupabaseService } from '../src/supabase/supabase.service';

describe('AuthSessionService linked identity lookup', () => {
  let rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>;
  let createUserCalls: unknown[];
  let generateLinkEmail: string | null;
  let service: AuthSessionService;

  beforeEach(() => {
    rpcCalls = [];
    createUserCalls = [];
    generateLinkEmail = null;

    const ephemeral = {
      auth: {
        verifyOtp: vi.fn(async () => ({
          data: {
            session: {
              access_token: 'access',
              refresh_token: 'refresh',
            },
          },
          error: null,
        })),
      },
    };

    const client = {
      auth: {
        admin: {
          createUser: vi.fn(async (payload: unknown) => {
            createUserCalls.push(payload);
            return { error: null };
          }),
          generateLink: vi.fn(async (params: { email: string }) => {
            generateLinkEmail = params.email;
            return {
              data: { properties: { hashed_token: 'hashed' } },
              error: null,
            };
          }),
          getUserById: vi.fn(async () => ({
            data: {
              user: {
                email: 'real@example.com',
                id: 'user-linked',
                phone: '+5491199999999',
              },
            },
            error: null,
          })),
        },
      },
      rpc: async (fn: string, args: Record<string, unknown>) => {
        rpcCalls.push({ args, fn });
        if (fn === 'find_auth_user_id_by_phone') {
          return { data: 'user-linked', error: null };
        }
        if (fn === 'find_auth_user_id_by_email') {
          return { data: 'user-linked', error: null };
        }
        return { data: null, error: null };
      },
    };

    const supabaseService = {
      createEphemeralServiceRoleClient: () => ephemeral,
      getServiceRoleClient: () => client,
    } as unknown as SupabaseService;

    service = new AuthSessionService(supabaseService);
  });

  it('mints session with the linked user email for phone login (no new synthetic user)', async () => {
    const session = await service.createSessionForPhone('+5491199999999');

    expect(rpcCalls.some((c) => c.fn === 'find_auth_user_id_by_phone')).toBe(true);
    expect(createUserCalls).toHaveLength(0);
    expect(generateLinkEmail).toBe('real@example.com');
    expect(session.accessToken).toBe('access');
    expect(session.refreshToken).toBe('refresh');
  });

  it('does not create a user when email already exists', async () => {
    await service.createSessionForEmail('real@example.com');
    expect(rpcCalls.some((c) => c.fn === 'find_auth_user_id_by_email')).toBe(true);
    expect(createUserCalls).toHaveLength(0);
    expect(generateLinkEmail).toBe('real@example.com');
  });
});
