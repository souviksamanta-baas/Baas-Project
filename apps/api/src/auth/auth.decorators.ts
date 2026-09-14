import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const SKIP_ORG_MEMBERSHIP_KEY = 'skipOrgMembership';

/** Skip JWT auth (health, webhooks, public OTP, job-secret cron). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Authenticated route that must not assert organization_members.
 * Used for Nexolia staff `/admin/*` (different tenancy) and user-scoped routes
 * that have no organizationId.
 */
export const SkipOrgMembership = () => SetMetadata(SKIP_ORG_MEMBERSHIP_KEY, true);
