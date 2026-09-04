import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';

/**
 * When a registered owner verifies email OTP for the first time,
 * attach their auth user to the org as owner (if not already a member).
 */
@Injectable()
export class RegisteredOwnerClaimService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async claimOwnerByEmail(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes('@')) {
      return;
    }

    const client = this.supabaseService.getServiceRoleClient();

    const { data: owners, error: ownersError } = await client
      .from('registered_owners')
      .select('id, organization_id, user_id, claimed_at')
      .ilike('email', normalized);

    if (ownersError || !owners?.length) {
      return;
    }

    const { data: linkData, error: linkError } = await client.auth.admin.generateLink({
      email: normalized,
      type: 'magiclink',
    });

    const user = linkData?.user;
    if (linkError || !user) {
      return;
    }

    const now = new Date().toISOString();

    for (const owner of owners) {
      if (!owner.user_id) {
        await client
          .from('registered_owners')
          .update({
            claimed_at: owner.claimed_at ?? now,
            updated_at: now,
            user_id: user.id,
          })
          .eq('id', owner.id);
      }

      const { data: existing } = await client
        .from('organization_members')
        .select('id')
        .eq('organization_id', owner.organization_id)
        .eq('user_id', user.id)
        .maybeSingle<{ id: string }>();

      if (existing) {
        continue;
      }

      const { data: member, error: memberError } = await client
        .from('organization_members')
        .insert({
          organization_id: owner.organization_id,
          role: 'owner',
          user_id: user.id,
        })
        .select('id')
        .single<{ id: string }>();

      if (memberError || !member) {
        continue;
      }

      const { data: centers } = await client
        .from('business_centers')
        .select('id')
        .eq('organization_id', owner.organization_id)
        .eq('is_default', true)
        .limit(1);

      const defaultCenterId = centers?.[0]?.id;
      if (!defaultCenterId) {
        continue;
      }

      await client.from('business_center_members').insert({
        business_center_id: defaultCenterId,
        organization_id: owner.organization_id,
        organization_member_id: member.id,
        role: 'manager',
      });
    }
  }
}
