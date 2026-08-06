import { apiFetchAuthJson } from './client';
import { supabase } from '../lib/supabase';

export async function archiveOrganization(params: {
  confirmation: string;
  organizationId: string;
}): Promise<{ archivedAt: string }> {
  return apiFetchAuthJson(`/organizations/${params.organizationId}/archive`, {
    body: JSON.stringify({ confirmation: params.confirmation }),
    method: 'POST',
  });
}

export async function deleteOrganization(params: {
  confirmation: string;
  organizationId: string;
}): Promise<{ deleted: true }> {
  return apiFetchAuthJson(`/organizations/${params.organizationId}`, {
    body: JSON.stringify({ confirmation: params.confirmation }),
    method: 'DELETE',
  });
}

export async function leaveOrganization(organizationId: string): Promise<{ left: true }> {
  return apiFetchAuthJson(`/organizations/${organizationId}/leave`, {
    method: 'POST',
  });
}

export async function transferOwnership(params: {
  newOwnerUserId: string;
  organizationId: string;
}): Promise<{ transferred: true }> {
  return apiFetchAuthJson(`/organizations/${params.organizationId}/transfer-ownership`, {
    body: JSON.stringify({ newOwnerUserId: params.newOwnerUserId }),
    method: 'POST',
  });
}

export type OrganizationMember = {
  displayName: string;
  email: string | null;
  role: string;
  userId: string;
};

type OrganizationMemberApiRow = {
  display_name?: string | null;
  displayName?: string | null;
  email?: string | null;
  role?: string;
  user_id?: string;
  userId?: string;
};

function resolveLocalFullName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null): string {
  if (!user) {
    return '';
  }

  const metadata = user.user_metadata ?? {};
  const fullName = String(metadata.full_name ?? metadata.name ?? '').trim();
  return fullName || String(user.email ?? '').trim();
}

export async function listOrganizationMembers(
  organizationId: string,
): Promise<OrganizationMember[]> {
  const rows = await apiFetchAuthJson<OrganizationMemberApiRow[]>(
    `/organizations/${organizationId}/members`,
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const localFullName = resolveLocalFullName(user);

  return rows.map((row) => {
    const userId = String(row.userId ?? row.user_id ?? '').trim();
    const email = typeof row.email === 'string' && row.email.trim() ? row.email.trim() : null;
    let displayName = String(row.displayName ?? row.display_name ?? '').trim();

    // Prefer the signed-in user's full_name when the API row is incomplete.
    if ((!displayName || displayName === 'Miembro') && user && user.id === userId && localFullName) {
      displayName = localFullName;
    }

    if (!displayName) {
      displayName = email || 'Miembro';
    }

    return {
      displayName,
      email,
      role: row.role === 'owner' ? 'owner' : String(row.role ?? 'staff'),
      userId,
    };
  });
}

export async function removeOrganizationMember(params: {
  organizationId: string;
  userId: string;
}): Promise<{ removed: true }> {
  return apiFetchAuthJson(`/organizations/${params.organizationId}/members/remove`, {
    body: JSON.stringify({ userId: params.userId }),
    method: 'POST',
  });
}

export async function exportOrganizationData(
  organizationId: string,
): Promise<Record<string, unknown>> {
  return apiFetchAuthJson(`/organizations/${organizationId}/export`);
}

export async function deleteAccount(confirmation: string): Promise<{ deleted: true }> {
  return apiFetchAuthJson('/organizations/account/delete', {
    body: JSON.stringify({ confirmation }),
    method: 'POST',
  });
}
