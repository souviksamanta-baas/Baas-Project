import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';

const ADMIN_RESET_URL =
  process.env.NEXOLIA_ADMIN_RESET_PASSWORD_URL?.trim() ||
  'https://admin.nexolia.com.ar/reset-password';

type ResendSendResponse = {
  id?: string;
  message?: string;
  name?: string;
};

@Injectable()
export class AdminPasswordResetService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Invitation-only: email must be staff or hold a pending invite.
   * Always returns the same opaque success to avoid account enumeration.
   */
  async requestReset(emailRaw: string): Promise<{ ok: true }> {
    const email = normalizeEmail(emailRaw);
    const client = this.supabaseService.getServiceRoleClient();

    const [{ data: staff }, { data: invite }] = await Promise.all([
      client
        .from('nexolia_staff')
        .select('user_id')
        .ilike('email', email)
        .maybeSingle<{ user_id: string }>(),
      client
        .from('nexolia_staff_invites')
        .select('id')
        .is('accepted_at', null)
        .ilike('email', email)
        .maybeSingle<{ id: string }>(),
    ]);

    if (!staff && !invite) {
      // Do not reveal whether the email exists.
      return { ok: true };
    }

    const { data, error } = await client.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    if (error) {
      console.error(
        `[admin-password-reset] generateLink failed for ${redactEmail(email)}: ${error.message}`,
      );
      return { ok: true };
    }

    const hashedToken = data.properties?.hashed_token?.trim();
    if (!hashedToken) {
      console.error(
        `[admin-password-reset] missing hashed_token for ${redactEmail(email)}`,
      );
      return { ok: true };
    }

    const resetUrl = `${ADMIN_RESET_URL}?token_hash=${encodeURIComponent(hashedToken)}&type=recovery`;

    try {
      await this.sendSpanishResetEmail({ email, resetUrl });
    } catch (err) {
      console.error(
        `[admin-password-reset] send failed for ${redactEmail(email)}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return { ok: true };
  }

  private async sendSpanishResetEmail(params: {
    email: string;
    resetUrl: string;
  }): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from =
      process.env.NEXOLIA_AUTH_EMAIL_FROM?.trim() ||
      'Nexolia <noreply@nexolia.com.ar>';

    if (!apiKey) {
      if (process.env.NODE_ENV !== 'production') {
        console.info(
          `[admin-password-reset] Dev mode — reset link for ${redactEmail(params.email)} (URL redacted).`,
        );
        return;
      }
      throw new Error('RESEND_API_KEY is not configured');
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
        subject: 'Restablecé tu contraseña de Nexolia Admin',
        html: [
          '<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#101935;max-width:560px">',
          '<h2 style="margin:0 0 12px;color:#101935">Restablecer contraseña</h2>',
          '<p>Recibimos un pedido para cambiar la contraseña de tu cuenta del portal Admin de Nexolia.</p>',
          '<p style="margin:24px 0">',
          `<a href="${params.resetUrl}" style="display:inline-block;background:#08bd66;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">Elegir nueva contraseña</a>`,
          '</p>',
          `<p style="font-size:14px;color:#56627b">Si el botón no funciona, copiá y pegá este enlace en el navegador:<br/><a href="${params.resetUrl}">${params.resetUrl}</a></p>`,
          '<p style="font-size:14px;color:#56627b">Si no pediste este cambio, podés ignorar este correo. El enlace vence en poco tiempo.</p>',
          '</div>',
        ].join(''),
        text: [
          'Restablecer contraseña — Nexolia Admin',
          '',
          'Usá este enlace para elegir una nueva contraseña:',
          params.resetUrl,
          '',
          'Si no pediste este cambio, ignorá este correo.',
        ].join('\n'),
      }),
    });

    const body = (await response.json().catch(() => ({}))) as ResendSendResponse;
    if (!response.ok) {
      const detail = body.message || body.name || `HTTP ${response.status}`;
      throw new Error(detail);
    }
  }
}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Ingresá un correo válido.');
  }
  return normalized;
}

function redactEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}
