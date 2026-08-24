/** Shared org role helpers for mobile UI gates. */

export type OrganizationMemberRole = 'owner' | 'co_owner' | 'manager' | 'staff';

export function normalizeOrganizationMemberRole(
  role: string | null | undefined,
): OrganizationMemberRole {
  if (role === 'owner' || role === 'co_owner' || role === 'manager') {
    return role;
  }
  return 'staff';
}

export function isOwnerOrCoOwner(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'co_owner';
}

export function canManageBusinessSettings(role: string | null | undefined): boolean {
  return isOwnerOrCoOwner(role);
}

export function canInviteStaffRole(
  actorRole: string | null | undefined,
  inviteRole: 'employee' | 'manager' | 'co_owner',
): boolean {
  if (isOwnerOrCoOwner(actorRole)) {
    return true;
  }
  return actorRole === 'manager' && inviteRole === 'employee';
}

export function memberRoleLabel(role: string | null | undefined): string {
  if (role === 'owner') {
    return 'Dueño';
  }
  if (role === 'co_owner') {
    return 'Co-dueño';
  }
  if (role === 'manager') {
    return 'Administrador';
  }
  return 'Equipo';
}
