import { apiFetchAuthJson } from './client';

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

export async function listOrganizationMembers(
  organizationId: string,
): Promise<Array<{ role: string; userId: string }>> {
  return apiFetchAuthJson(`/organizations/${organizationId}/members`);
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
