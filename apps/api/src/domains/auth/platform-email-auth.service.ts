import { Injectable } from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import { SupabaseService } from '../../supabase/supabase.service';

interface ResendSendResponse {
  id?: string;
  message?: string;
  name?: string;
  statusCode?: number;
}

const OTP_RESEND_COOLDOWN_MS = 45_000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class PlatformEmailAuthService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async requestOtp(email: string): Promise<void> {
    const normalizedEmail = normalizeLoginEmail(email);
    await this.assertResendAllowed(normalizedEmail);

    const code = String(randomInt(100_000, 1_000_000));
    const codeHash = this.hashOtp(code);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS).toISOString();

    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client.from('auth_otp_challenges').insert({
      channel: 'email',
      email: normalizedEmail,
      code_hash: codeHash,
      expires_at: expiresAt,
      last_sent_at: now.toISOString(),
    });

    if (error) {
      throw new Error(`Failed to store OTP challenge: ${error.message}`);
    }

    await this.sendOtpEmail({ code, email: normalizedEmail });
  }

  async verifyOtp(params: { code: string; email: string }): Promise<boolean> {
    const normalizedEmail = normalizeLoginEmail(params.email);
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('auth_otp_challenges')
      .select('id, code_hash, expires_at, attempts, consumed_at')
      .eq('email', normalizedEmail)
      .eq('channel', 'email')
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{
        attempts: number;
        code_hash: string;
        consumed_at: string | null;
        expires_at: string;
        id: string;
      }>();

    if (error) {
      throw new Error(`Failed to load OTP challenge: ${error.message}`);
    }

    if (!data) {
      return false;
    }

    if (data.attempts >= OTP_MAX_ATTEMPTS) {
      throw new Error('Demasiados intentos. Pedí un código nuevo.');
    }

    if (new Date(data.expires_at).getTime() < Date.now()) {
      throw new Error('El código expiró. Pedí uno nuevo.');
    }

    const submittedHash = this.hashOtp(params.code.trim());
    const isValid = this.equalHexDigests(submittedHash, data.code_hash);

    await client
      .from('auth_otp_challenges')
      .update({
        attempts: data.attempts + 1,
        consumed_at: isValid ? new Date().toISOString() : data.consumed_at,
      })
      .eq('id', data.id);

    return isValid;
  }

  private async assertResendAllowed(email: string): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('auth_otp_challenges')
      .select('last_sent_at, created_at')
      .eq('email', email)
      .eq('channel', 'email')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ created_at: string; last_sent_at: string | null }>();

    if (error) {
      throw new Error(`Failed to check OTP cooldown: ${error.message}`);
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
    const pepper =
      process.env.BAAS_OTP_PEPPER?.trim() ||
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      'nexolia-otp-dev-pepper';

    return createHmac('sha256', pepper).update(code).digest('hex');
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

  private async sendOtpEmail(params: { code: string; email: string }): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from =
      process.env.NEXOLIA_AUTH_EMAIL_FROM?.trim() || 'Nexolia <noreply@nexolia.com.ar>';

    if (!apiKey) {
      if (process.env.NODE_ENV !== 'production') {
        console.info(
          `[auth-otp] Dev mode — email OTP for ${redactEmail(params.email)} (code redacted).`,
        );
        return;
      }

      throw new Error('Platform email auth is not configured (RESEND_API_KEY).');
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
        subject: 'Tu código para ingresar a Nexolia',
        html: [
          '<h2>Tu código para ingresar a Nexolia</h2>',
          '<p>Tu código de acceso es:</p>',
          `<p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0;">${params.code}</p>`,
          '<p>Ingresá este código en la app para continuar.</p>',
          '<p style="color:#56627b;font-size:14px;">Si no pediste este código, podés ignorar este correo.</p>',
        ].join(''),
        text: `Tu código para ingresar a Nexolia es ${params.code}`,
      }),
    });

    const body = (await response.json().catch(() => ({}))) as ResendSendResponse;

    if (!response.ok) {
      const detail = body.message || body.name || `HTTP ${response.status}`;
      console.error(`[auth-otp] Resend email failed for ${redactEmail(params.email)}: ${detail}`);
      if (/only send testing emails|verify a domain/i.test(detail)) {
        throw new Error(
          'Email SMTP aún en modo prueba. Verificá el dominio nexolia.com.ar en Resend y usá un remitente de ese dominio.',
        );
      }
      throw new Error(`No se pudo enviar el correo: ${detail}`);
    }
  }
}

export function normalizeLoginEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
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
