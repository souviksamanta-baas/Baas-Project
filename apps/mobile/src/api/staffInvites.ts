import { apiFetchAuthJson } from './client';

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
  businessCenterId?: string;
  invitedDisplayName?: string;
  invitedPhoneE164: string;
  organizationId: string;
  role: StaffInviteRole;
}): Promise<CreateStaffInviteResult> {
  return apiFetchAuthJson<CreateStaffInviteResult>('/organizations/invites', {
    body: JSON.stringify({
      businessCenterId: params.businessCenterId,
      invitedDisplayName: params.invitedDisplayName,
      invitedPhoneE164: params.invitedPhoneE164,
      organizationId: params.organizationId,
      role: params.role,
    }),
    method: 'POST',
  });
}

export async function acceptStaffInvite(params: {
  inviteToken: string;
  verifiedPhoneE164: string;
}): Promise<{ organizationId: string }> {
  return apiFetchAuthJson<{ organizationId: string }>('/organizations/invites/accept', {
    body: JSON.stringify({
      inviteToken: params.inviteToken,
      verifiedPhoneE164: params.verifiedPhoneE164,
    }),
    method: 'POST',
  });
}

export function buildStaffInviteDeepLink(inviteToken: string): string {
  return `baas-owner://invite-accept?token=${encodeURIComponent(inviteToken)}`;
}

export { parseStaffInviteToken } from '../lib/staffInviteToken';
