import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { User } from '@supabase/supabase-js';

import {
  normalizeAuthPhoneE164,
  phoneFromAuthUser,
  resolveAuthUser,
} from '../../auth/request-auth.helper';
import { SupabaseService } from '../../supabase/supabase.service';
import { phoneToSyntheticEmail } from './auth-phone.util';
import {
  normalizeLoginEmail,
  PlatformEmailAuthService,
} from './platform-email-auth.service';

const SYNTHETIC_EMAIL_SUFFIX = '@auth.nexolia.app';
const MERGE_TTL_MS = 10 * 60 * 1000;
const SMS_LINK_TTL_MS = 10 * 60 * 1000;
const SMS_LINK_RESEND_COOLDOWN_MS = 45_000;

export type IdentityMeResponse = {
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
};

export type MergeOrgPreview = {
  name: string;
  organizationId: string;
  role: string;
};

export type IdentityVerifyResponse =
  | {
      identities: IdentityMeResponse;
      status: 'linked';
    }
  | {
      mergeToken: string;
      organizations: MergeOrgPreview[];
      status: 'merge_required';
      warning: string;
    };

@Injectable()
export class IdentityLinkService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly emailAuthService: PlatformEmailAuthService,
  ) {}

  async getMe(authorizationHeader: string | undefined): Promise<IdentityMeResponse> {
    const user = await this.requireOwnerUser(authorizationHeader);
    return this.identitiesFromUser(user);
  }

  async requestEmailLink(
    authorizationHeader: string | undefined,
    email: string,
  ): Promise<{ ok: true }> {
    const user = await this.requireOwnerUser(authorizationHeader);
    const normalized = normalizeLoginEmail(email);
    this.assertCanAddEmail(user, normalized);

    try {
      await this.emailAuthService.requestOtp(normalized, 'link');
    } catch (error) {
      // Avoid enumeration: cooldown/errors that reveal nothing about existence stay as-is.
      throw error;
    }

    return { ok: true };
  }

  /** Phone link uses Supabase SMS (Twilio), same as login — not platform WhatsApp. */
  async requestPhoneLink(
    authorizationHeader: string | undefined,
    phone: string,
  ): Promise<{ ok: true }> {
    const user = await this.requireOwnerUser(authorizationHeader);
    const phoneE164 = requirePhoneE164(phone);
    this.assertCanAddPhone(user, phoneE164);
    await this.assertSmsLinkResendAllowed(phoneE164);

    const client = this.supabaseService.getServiceRoleClient();
    const now = new Date();
    const { error: challengeError } = await client.from('auth_otp_challenges').insert({
      channel: 'sms',
      phone_e164: phoneE164,
      purpose: 'link',
      // Real OTP is owned by Supabase Auth; this row only records link intent + cooldown.
      code_hash: createHash('sha256')
        .update(`sms-link:${user.id}:${phoneE164}:${now.toISOString()}`)
        .digest('hex'),
      expires_at: new Date(now.getTime() + SMS_LINK_TTL_MS).toISOString(),
      last_sent_at: now.toISOString(),
    });

    if (challengeError) {
      console.error(
        `[identity-link] Failed to store SMS link challenge: ${challengeError.message}`,
      );
      throw new Error('No se pudo preparar el código. Intentá de nuevo en unos segundos.');
    }

    const ephemeral = this.supabaseService.createEphemeralServiceRoleClient();
    const { error } = await ephemeral.auth.signInWithOtp({
      phone: phoneE164,
    });

    if (error) {
      console.error(`[identity-link] SMS OTP send failed: ${error.message}`);
      throw new Error(
        formatSmsSendError(error.message) ||
          'No se pudo enviar el SMS. Verificá el número e intentá de nuevo.',
      );
    }

    return { ok: true };
  }

  /** @deprecated Use requestPhoneLink — WhatsApp is not used for identity linking. */
  async requestWhatsAppLink(
    authorizationHeader: string | undefined,
    phone: string,
  ): Promise<{ ok: true }> {
    return this.requestPhoneLink(authorizationHeader, phone);
  }

  async verifyEmailLink(
    authorizationHeader: string | undefined,
    params: { code: string; email: string },
  ): Promise<IdentityVerifyResponse> {
    const keeper = await this.requireOwnerUser(authorizationHeader);
    const normalized = normalizeLoginEmail(params.email);
    this.assertCanAddEmail(keeper, normalized);

    const isValid = await this.emailAuthService.verifyOtp({
      code: params.code,
      email: normalized,
      purpose: 'link',
    });
    if (!isValid) {
      throw new UnauthorizedException('Código inválido.');
    }

    return this.completeIdentityProof({
      identityKind: 'email',
      identityValue: normalized,
      keeper,
    });
  }

  async verifyPhoneLink(
    authorizationHeader: string | undefined,
    params: { code: string; phone: string },
  ): Promise<IdentityVerifyResponse> {
    const keeper = await this.requireOwnerUser(authorizationHeader);
    const phoneE164 = requirePhoneE164(params.phone);
    this.assertCanAddPhone(keeper, phoneE164);

    const challenge = await this.consumeSmsLinkChallenge(phoneE164);
    if (!challenge) {
      throw new UnauthorizedException(
        'Pedí un código nuevo desde Actualizar perfil e intentá otra vez.',
      );
    }

    const code = params.code.trim();
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException('Ingresá el código de 6 dígitos del SMS.');
    }

    const ephemeral = this.supabaseService.createEphemeralServiceRoleClient();
    const verified = await ephemeral.auth.verifyOtp({
      phone: phoneE164,
      token: code,
      type: 'sms',
    });

    if (verified.error || !verified.data.user) {
      throw new UnauthorizedException('Código inválido.');
    }

    // Ephemeral session must never be returned to the client.
    try {
      await ephemeral.auth.signOut({ scope: 'local' });
    } catch {
      // best-effort
    }

    return this.completeIdentityProof({
      identityKind: 'phone',
      identityValue: phoneE164,
      keeper,
    });
  }

  /** @deprecated Use verifyPhoneLink — WhatsApp is not used for identity linking. */
  async verifyWhatsAppLink(
    authorizationHeader: string | undefined,
    params: { code: string; phone: string },
  ): Promise<IdentityVerifyResponse> {
    return this.verifyPhoneLink(authorizationHeader, params);
  }

  async confirmMerge(
    authorizationHeader: string | undefined,
    mergeToken: string,
  ): Promise<{ identities: IdentityMeResponse; status: 'linked' }> {
    const keeper = await this.requireOwnerUser(authorizationHeader);
    const token = mergeToken?.trim();
    if (!token) {
      throw new BadRequestException('Falta el token de confirmación.');
    }

    const client = this.supabaseService.getServiceRoleClient();
    const tokenHash = hashMergeToken(token);
    const { data, error } = await client
      .from('auth_identity_merge_challenges')
      .select('id, keeper_user_id, donor_user_id, identity_kind, identity_value, expires_at, consumed_at')
      .eq('token_hash', tokenHash)
      .maybeSingle<{
        consumed_at: string | null;
        donor_user_id: string;
        expires_at: string;
        id: string;
        identity_kind: 'email' | 'phone';
        identity_value: string;
        keeper_user_id: string;
      }>();

    if (error) {
      throw new Error(`Failed to load merge challenge: ${error.message}`);
    }

    if (!data || data.keeper_user_id !== keeper.id) {
      throw new BadRequestException('La confirmación no es válida.');
    }

    if (data.consumed_at) {
      throw new BadRequestException('Esta confirmación ya se usó.');
    }

    if (new Date(data.expires_at).getTime() < Date.now()) {
      throw new BadRequestException('La confirmación expiró. Volvé a verificar el código.');
    }

    await this.runMergeAndAttach({
      donorUserId: data.donor_user_id,
      identityKind: data.identity_kind,
      identityValue: data.identity_value,
      keeperUserId: keeper.id,
    });

    await client
      .from('auth_identity_merge_challenges')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', data.id);

    const refreshed = await this.loadUser(keeper.id);
    await this.notifyIdentityLinked({
      identityKind: data.identity_kind,
      identityValue: data.identity_value,
      user: refreshed,
    });

    return { identities: this.identitiesFromUser(refreshed), status: 'linked' };
  }

  private async completeIdentityProof(params: {
    identityKind: 'email' | 'phone';
    identityValue: string;
    keeper: User;
  }): Promise<IdentityVerifyResponse> {
    const donorId =
      params.identityKind === 'email'
        ? await this.findUserIdByEmail(params.identityValue)
        : await this.findUserIdByPhone(params.identityValue);

    if (!donorId || donorId === params.keeper.id) {
      await this.attachIdentityToUser({
        identityKind: params.identityKind,
        identityValue: params.identityValue,
        userId: params.keeper.id,
      });
      const refreshed = await this.loadUser(params.keeper.id);
      await this.notifyIdentityLinked({
        identityKind: params.identityKind,
        identityValue: params.identityValue,
        user: refreshed,
      });
      return { identities: this.identitiesFromUser(refreshed), status: 'linked' };
    }

    await this.assertNotStaff(donorId);
    const organizations = await this.listDonorOrganizations(donorId);

    // Empty donor (typical after SMS verify creates a fresh phone-only user): absorb without confirm.
    if (organizations.length === 0) {
      await this.runMergeAndAttach({
        donorUserId: donorId,
        identityKind: params.identityKind,
        identityValue: params.identityValue,
        keeperUserId: params.keeper.id,
      });
      const refreshed = await this.loadUser(params.keeper.id);
      await this.notifyIdentityLinked({
        identityKind: params.identityKind,
        identityValue: params.identityValue,
        user: refreshed,
      });
      return { identities: this.identitiesFromUser(refreshed), status: 'linked' };
    }

    const mergeToken = await this.createMergeChallenge({
      donorUserId: donorId,
      identityKind: params.identityKind,
      identityValue: params.identityValue,
      keeperUserId: params.keeper.id,
    });

    return {
      mergeToken,
      organizations,
      status: 'merge_required',
      warning:
        'Si confirmás, los negocios de la otra cuenta pasarán a esta sesión y ese otro ingreso dejará de existir.',
    };
  }

  private async runMergeAndAttach(params: {
    donorUserId: string;
    identityKind: 'email' | 'phone';
    identityValue: string;
    keeperUserId: string;
  }): Promise<void> {
    // Never absorb a staff auth user. Keeper may be dual-hat staff+owner.
    await this.assertNotStaff(params.donorUserId);

    const client = this.supabaseService.getServiceRoleClient();
    const { error: mergeError } = await client.rpc('merge_auth_user', {
      p_from: params.donorUserId,
      p_to: params.keeperUserId,
    });

    if (mergeError) {
      throw new BadRequestException(
        mergeError.message || 'No se pudo unificar las cuentas.',
      );
    }

    // Revoke donor sessions before delete
    try {
      await client.auth.admin.signOut(params.donorUserId, 'global');
    } catch {
      // best-effort
    }

    const { error: deleteError } = await client.auth.admin.deleteUser(params.donorUserId);
    if (deleteError && !/not found|user not found/i.test(deleteError.message)) {
      console.error(`[identity-link] Failed to delete donor user: ${deleteError.message}`);
      throw new Error('Se unificaron los negocios pero no se pudo cerrar la otra cuenta.');
    }

    await this.attachIdentityToUser({
      identityKind: params.identityKind,
      identityValue: params.identityValue,
      userId: params.keeperUserId,
    });
  }

  private async attachIdentityToUser(params: {
    identityKind: 'email' | 'phone';
    identityValue: string;
    userId: string;
  }): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const current = await this.loadUser(params.userId);

    if (params.identityKind === 'email') {
      const meta = {
        ...(current.user_metadata ?? {}),
        auth_email: params.identityValue,
      };
      const { error } = await client.auth.admin.updateUserById(params.userId, {
        email: params.identityValue,
        email_confirm: true,
        user_metadata: meta,
      });
      if (error) {
        throw new BadRequestException(
          error.message || 'No se pudo vincular el correo.',
        );
      }
      return;
    }

    const meta = {
      ...(current.user_metadata ?? {}),
      auth_phone: params.identityValue,
    };
    // Clear stale free-text phone metadata so profile only shows verified phone.
    delete (meta as { phone?: unknown }).phone;

    const { error } = await client.auth.admin.updateUserById(params.userId, {
      phone: params.identityValue,
      phone_confirm: true,
      user_metadata: meta,
    });
    if (error) {
      throw new BadRequestException(
        error.message || 'No se pudo vincular el teléfono.',
      );
    }
  }

  private async createMergeChallenge(params: {
    donorUserId: string;
    identityKind: 'email' | 'phone';
    identityValue: string;
    keeperUserId: string;
  }): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client.from('auth_identity_merge_challenges').insert({
      token_hash: hashMergeToken(token),
      keeper_user_id: params.keeperUserId,
      donor_user_id: params.donorUserId,
      identity_kind: params.identityKind,
      identity_value: params.identityValue,
      expires_at: new Date(Date.now() + MERGE_TTL_MS).toISOString(),
    });

    if (error) {
      throw new Error(`Failed to create merge challenge: ${error.message}`);
    }

    return token;
  }

  private async listDonorOrganizations(donorUserId: string): Promise<MergeOrgPreview[]> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('organization_members')
      .select('role, organization_id, organizations!inner(name, archived_at)')
      .eq('user_id', donorUserId);

    if (error) {
      throw new Error(`Failed to list donor organizations: ${error.message}`);
    }

    return (data ?? [])
      .map((row) => {
        const org = row.organizations as
          | { archived_at: string | null; name: string }
          | { archived_at: string | null; name: string }[]
          | null;
        const orgRow = Array.isArray(org) ? org[0] : org;
        if (!orgRow || orgRow.archived_at) {
          return null;
        }
        return {
          name: orgRow.name,
          organizationId: row.organization_id as string,
          role: String(row.role),
        };
      })
      .filter((row): row is MergeOrgPreview => row !== null);
  }

  private async findUserIdByEmail(email: string): Promise<string | null> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client.rpc('find_auth_user_id_by_email', {
      p_email: email,
    });
    if (error) {
      throw new Error(`Failed to look up email user: ${error.message}`);
    }
    return typeof data === 'string' && data ? data : null;
  }

  private async findUserIdByPhone(phoneE164: string): Promise<string | null> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client.rpc('find_auth_user_id_by_phone', {
      p_phone_e164: phoneE164,
    });
    if (error) {
      throw new Error(`Failed to look up phone user: ${error.message}`);
    }
    return typeof data === 'string' && data ? data : null;
  }

  private async assertSmsLinkResendAllowed(phoneE164: string): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('auth_otp_challenges')
      .select('last_sent_at, created_at')
      .eq('phone_e164', phoneE164)
      .eq('channel', 'sms')
      .eq('purpose', 'link')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ created_at: string; last_sent_at: string | null }>();

    if (error) {
      console.error(`[identity-link] Failed to check SMS link cooldown: ${error.message}`);
      throw new Error('No se pudo enviar el código. Intentá de nuevo en unos segundos.');
    }

    const lastSent = data?.last_sent_at ?? data?.created_at;
    if (!lastSent) {
      return;
    }

    const elapsed = Date.now() - new Date(lastSent).getTime();
    if (elapsed < SMS_LINK_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((SMS_LINK_RESEND_COOLDOWN_MS - elapsed) / 1000);
      throw new Error(`Esperá ${waitSec}s antes de pedir otro código.`);
    }
  }

  private async consumeSmsLinkChallenge(phoneE164: string): Promise<boolean> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('auth_otp_challenges')
      .select('id, expires_at, consumed_at')
      .eq('phone_e164', phoneE164)
      .eq('channel', 'sms')
      .eq('purpose', 'link')
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ consumed_at: string | null; expires_at: string; id: string }>();

    if (error) {
      console.error(`[identity-link] Failed to load SMS link challenge: ${error.message}`);
      throw new Error('No se pudo verificar el código. Intentá de nuevo.');
    }

    if (!data) {
      return false;
    }

    if (new Date(data.expires_at).getTime() < Date.now()) {
      return false;
    }

    await client
      .from('auth_otp_challenges')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', data.id);

    return true;
  }

  private async requireOwnerUser(authorizationHeader: string | undefined): Promise<User> {
    const user = await resolveAuthUser(this.supabaseService, authorizationHeader);
    // Dual-hat staff (e.g. founder also using Owner app) may link identities when they
    // already belong to a tenant. Pure nexolia_staff with no org membership stays blocked.
    await this.assertOwnerAppCaller(user.id);
    return user;
  }

  private async assertOwnerAppCaller(userId: string): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data: membership, error: membershipError } = await client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle<{ organization_id: string }>();

    if (membershipError) {
      throw new Error(`Failed to verify organization membership: ${membershipError.message}`);
    }

    if (membership) {
      return;
    }

    const { data: staff, error: staffError } = await client
      .from('nexolia_staff')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle<{ user_id: string }>();

    if (staffError) {
      throw new Error(`Failed to verify staff exclusion: ${staffError.message}`);
    }

    if (staff) {
      throw new ForbiddenException(
        'Las cuentas de staff de Nexolia sin un negocio no pueden vincular identidades de dueños.',
      );
    }
  }

  private async assertNotStaff(userId: string): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('nexolia_staff')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle<{ user_id: string }>();

    if (error) {
      throw new Error(`Failed to verify staff exclusion: ${error.message}`);
    }

    if (data) {
      throw new ForbiddenException(
        'No se puede unificar una cuenta de staff de Nexolia.',
      );
    }
  }

  private assertCanAddEmail(user: User, email: string): void {
    const current = resolveRealEmail(user);
    if (current && current !== email) {
      throw new BadRequestException(
        'Esta cuenta ya tiene un correo verificado. El cambio de correo no está disponible todavía.',
      );
    }
  }

  private assertCanAddPhone(user: User, phoneE164: string): void {
    const current = phoneFromAuthUser(user);
    if (current && current !== phoneE164) {
      throw new BadRequestException(
        'Esta cuenta ya tiene un teléfono verificado. El cambio de teléfono no está disponible todavía.',
      );
    }
  }

  private identitiesFromUser(user: User): IdentityMeResponse {
    const email = resolveRealEmail(user);
    const phone = phoneFromAuthUser(user);
    return {
      email,
      emailVerified: Boolean(email),
      phone,
      phoneVerified: Boolean(phone),
    };
  }

  private async loadUser(userId: string): Promise<User> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client.auth.admin.getUserById(userId);
    if (error || !data.user) {
      throw new Error(error?.message ?? 'Usuario no encontrado.');
    }
    return data.user;
  }

  private async notifyIdentityLinked(params: {
    identityKind: 'email' | 'phone';
    identityValue: string;
    user: User;
  }): Promise<void> {
    const email = resolveRealEmail(params.user);
    const phone = phoneFromAuthUser(params.user);
    const subject =
      params.identityKind === 'email'
        ? 'Vinculaste un correo a tu cuenta Nexolia'
        : 'Vinculaste un teléfono a tu cuenta Nexolia';
    const body =
      params.identityKind === 'email'
        ? `Se vinculó el correo ${params.identityValue} a tu cuenta Nexolia. Si no fuiste vos, escribinos a privacidad@nexolia.com.ar.`
        : `Se vinculó el teléfono ${params.identityValue} a tu cuenta Nexolia. Si no fuiste vos, escribinos a privacidad@nexolia.com.ar.`;

    // Best-effort notices on both channels when available.
    if (email) {
      void this.sendSecurityEmail({ email, subject, text: body }).catch((err) => {
        console.error(
          `[identity-link] security email failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }

    if (phone) {
      console.info(
        `[identity-link] Security notice for phone ***${phone.slice(-4)}: ${subject}`,
      );
    }
  }

  private async sendSecurityEmail(params: {
    email: string;
    subject: string;
    text: string;
  }): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from =
      process.env.NEXOLIA_AUTH_EMAIL_FROM?.trim() || 'Nexolia <noreply@nexolia.com.ar>';
    if (!apiKey) {
      return;
    }

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.email],
        subject: params.subject,
        text: params.text,
      }),
    });
  }
}

export function resolveRealEmail(user: User): string | null {
  const email = user.email?.trim().toLowerCase() ?? '';
  if (!email || email.endsWith(SYNTHETIC_EMAIL_SUFFIX)) {
    return null;
  }
  return email;
}

export function requirePhoneE164(value: string): string {
  const normalized = normalizeAuthPhoneE164(value);
  if (!normalized) {
    throw new BadRequestException(
      'Ingresá el teléfono en formato internacional (ej. +54911…).',
    );
  }
  return normalized;
}

function formatSmsSendError(message: string): string | null {
  const lower = message.toLowerCase();
  if (/unsupported phone|phone provider|sms|twilio/i.test(lower)) {
    return 'El envío de SMS no está configurado o el número no es válido. Revisá Twilio en Supabase Auth.';
  }
  if (/rate|too many|cooldown/i.test(lower)) {
    return 'Esperá unos segundos antes de pedir otro SMS.';
  }
  return null;
}

function hashMergeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Exported for AuthSessionService phone→email minting after link. */
export function sessionEmailForPhoneUser(user: {
  email?: string | null;
  phone?: string | null;
}): string {
  const email = user.email?.trim() ?? '';
  if (email) {
    return email;
  }
  const phone = user.phone?.trim();
  if (phone) {
    return phoneToSyntheticEmail(phone);
  }
  throw new Error('Usuario sin email ni teléfono para mint de sesión.');
}
