const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

export type StaffInviteRole = 'employee' | 'manager' | 'co_owner';

export interface CreateStaffInviteResult {
  expiresAt: string;
  id: string;
  inviteToken: string;
  invitedDisplayName: string | null;
  invitedPhoneE164: string;
  organizationId: string;
  role: StaffInviteRole;
}

export async function createStaffInvite(params: {
  authorizationToken: string;
  businessCenterId?: string;
  invitedDisplayName?: string;
  invitedPhoneE164: string;
  organizationId: string;
  role: StaffInviteRole;
}): Promise<CreateStaffInviteResult> {
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is required to crear invitaciones.');
  }

  const response = await fetch(`${apiBaseUrl}/organizations/invites`, {
    body: JSON.stringify({
      businessCenterId: params.businessCenterId,
      invitedDisplayName: params.invitedDisplayName,
      invitedPhoneE164: params.invitedPhoneE164,
      organizationId: params.organizationId,
      role: params.role,
    }),
    headers: {
      Authorization: `Bearer ${params.authorizationToken}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `No se pudo crear la invitación (HTTP ${response.status}).`);
  }

  return (await response.json()) as CreateStaffInviteResult;
}

export async function acceptStaffInvite(params: {
  authorizationToken: string;
  inviteToken: string;
  verifiedPhoneE164: string;
}): Promise<{ organizationId: string }> {
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is required to aceptar invitaciones.');
  }

  const response = await fetch(`${apiBaseUrl}/organizations/invites/accept`, {
    body: JSON.stringify({
      inviteToken: params.inviteToken,
      verifiedPhoneE164: params.verifiedPhoneE164,
    }),
    headers: {
      Authorization: `Bearer ${params.authorizationToken}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `No se pudo aceptar la invitación (HTTP ${response.status}).`);
  }

  return (await response.json()) as { organizationId: string };
}

export function buildStaffInviteDeepLink(inviteToken: string): string {
  return `baas-owner://invite-accept?token=${encodeURIComponent(inviteToken)}`;
}

export function parseStaffInviteToken(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.searchParams.get('token');
  } catch {
    return value.trim();
  }
}
