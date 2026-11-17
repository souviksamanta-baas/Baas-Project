import { Injectable } from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import { resolveOtpPepper } from '../../auth/otp-pepper.util';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  assertAuthOtpIdentityUnlocked,
  claimAuthOtpAttempt,
  otpClaimFailureMessage,
} from './auth-otp-attempt.util';
import { isAppReviewDemoCode, isAppReviewDemoEmail } from './app-review-login';

interface ResendSendResponse {
  id?: string;
  message?: string;
  name?: string;
  statusCode?: number;
}

const OTP_RESEND_COOLDOWN_MS = 45_000;
const OTP_TTL_MS = 10 * 60 * 1000;

export type AuthOtpPurpose = 'login' | 'link';

@Injectable()
export class PlatformEmailAuthService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async requestOtp(
    email: string,
    purpose: AuthOtpPurpose = 'login',
  ): Promise<void> {
    const normalizedEmail = normalizeLoginEmail(email);
    if (purpose === 'login' && isAppReviewDemoEmail(normalizedEmail)) {
      return;
    }
    await this.assertResendAllowed(normalizedEmail, purpose);

    const client = this.supabaseService.getServiceRoleClient();
    await assertAuthOtpIdentityUnlocked({
      channel: 'email',
      client,
      email: normalizedEmail,
      purpose,
    });

    const code = String(randomInt(100_000, 1_000_000));
    const codeHash = this.hashOtp(code);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS).toISOString();

    const { error } = await client.from('auth_otp_challenges').insert({
      channel: 'email',
      email: normalizedEmail,
      purpose,
      code_hash: codeHash,
      expires_at: expiresAt,
      last_sent_at: now.toISOString(),
    });

    if (error) {
      console.error(`[auth-otp] Failed to store email OTP challenge: ${error.message}`);
      throw new Error('No se pudo preparar el código. Intentá de nuevo en unos segundos.');
    }

    await this.sendOtpEmail({ code, email: normalizedEmail, purpose });
  }

  async verifyOtp(params: {
    code: string;
    email: string;
    purpose?: AuthOtpPurpose;
  }): Promise<boolean> {
    const purpose = params.purpose ?? 'login';
    const normalizedEmail = normalizeLoginEmail(params.email);
    if (purpose === 'login' && isAppReviewDemoEmail(normalizedEmail)) {
      return isAppReviewDemoCode(normalizedEmail, params.code);
    }
    const client = this.supabaseService.getServiceRoleClient();
    const claim = await claimAuthOtpAttempt({
      channel: 'email',
      client,
      email: normalizedEmail,
      purpose,
    });

    if (!claim.ok) {
      const message = otpClaimFailureMessage(claim.reason);
      if (message) {
        throw new Error(message);
      }
      return false;
    }

    const submittedHash = this.hashOtp(params.code.trim());
    const isValid = this.equalHexDigests(submittedHash, claim.codeHash);

    if (isValid) {
      await client
        .from('auth_otp_challenges')
        .update({ consumed_at: new Date().toISOString() })
        .eq('id', claim.id);
    }

    return isValid;
  }

  private async assertResendAllowed(
    email: string,
    purpose: AuthOtpPurpose,
  ): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('auth_otp_challenges')
      .select('last_sent_at, created_at')
      .eq('email', email)
      .eq('channel', 'email')
      .eq('purpose', purpose)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ created_at: string; last_sent_at: string | null }>();

    if (error) {
      console.error(`[auth-otp] Failed to check email OTP cooldown: ${error.message}`);
      throw new Error('No se pudo enviar el código. Intentá de nuevo en unos segundos.');
    }

    const lastSent = data?.last_sent_at ?? data?.created_at;
    if (!lastSent) {
      return;
    }

    const elapsed = Date.now() - new Date(lastSent).getTime();
    if (elapsed < OTP_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
      throw new Error(`Esperá ${waitSec}s antes de pedir otro código.`);
    }
  }

  private hashOtp(code: string): string {
    return createHmac('sha256', resolveOtpPepper()).update(code).digest('hex');
  }

  private equalHexDigests(a: string, b: string): boolean {
    try {
      const left = Buffer.from(a, 'hex');
      const right = Buffer.from(b, 'hex');
      if (left.length !== right.length || left.length === 0) {
        return false;
      }
      return timingSafeEqual(left, right);
    } catch {
      return false;
    }
  }

  private async sendOtpEmail(params: {
    code: string;
    email: string;
    purpose: AuthOtpPurpose;
  }): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from =
      process.env.NEXOLIA_AUTH_EMAIL_FROM?.trim() || 'Nexolia <noreply@nexolia.com.ar>';
    const isLink = params.purpose === 'link';
    const subject = isLink
      ? 'Tu código para vincular el correo en Nexolia'
      : 'Tu código para ingresar a Nexolia';

    if (!apiKey) {
      if (process.env.NODE_ENV !== 'production') {
        console.info(
          `[auth-otp] Dev mode — email OTP for ${redactEmail(params.email)} (code redacted).`,
        );
        return;
      }

      throw new Error('El envío de correo de ingreso no está configurado. Probá más tarde o usá SMS.');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.email],
        subject,
        html: [
          `<h2>${subject}</h2>`,
          '<p>Tu código es:</p>',
          `<p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0;">${params.code}</p>`,
          isLink
            ? '<p>Ingresá este código en Actualizar perfil para vincular tu correo.</p>'
            : '<p>Ingresá este código en la app para continuar.</p>',
          '<p style="color:#56627b;font-size:14px;">Si no pediste este código, podés ignorar este correo.</p>',
        ].join(''),
        text: `${subject}: ${params.code}`,
      }),
    });

    const body = (await response.json().catch(() => ({}))) as ResendSendResponse;

    if (!response.ok) {
      const detail = body.message || body.name || `HTTP ${response.status}`;
      console.error(`[auth-otp] Resend email failed for ${redactEmail(params.email)}: ${detail}`);
      if (/only send testing emails|verify a domain/i.test(detail)) {
        throw new Error(
          'No se pudo enviar el correo todavía. Probá de nuevo más tarde o usá SMS.',
        );
      }
      throw new Error('No se pudo enviar el correo. Intentá de nuevo en unos segundos.');
    }
  }
}

export function normalizeLoginEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Ingresá un correo válido.');
  }
  // Defense in depth: reject SQL LIKE wildcards. Real Nexolia login emails
  // never contain `%` or `_` and we want eq/ilike lookups to be literal.
  if (/[%_]/.test(normalized)) {
    throw new Error('Ingresá un correo válido.');
  }
  return normalized;
}

function redactEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) {
    return '***';
  }
  const prefix = local.slice(0, 2);
  return `${prefix}***@${domain}`;
}
