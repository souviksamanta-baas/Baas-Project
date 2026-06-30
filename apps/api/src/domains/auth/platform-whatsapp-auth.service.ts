import { Injectable } from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';

import { SupabaseService } from '../../supabase/supabase.service';
import { normalizeWhatsAppRecipient } from './auth-phone.util';

interface MetaSendResponse {
  error?: {
    message?: string;
  };
  messages?: Array<{ id?: string }>;
}

@Injectable()
export class PlatformWhatsAppAuthService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async requestOtp(phoneE164: string): Promise<void> {
    const code = String(randomInt(100_000, 1_000_000));
    const codeHash = createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client.from('auth_otp_challenges').insert({
      channel: 'whatsapp',
      phone_e164: phoneE164,
      code_hash: codeHash,
      expires_at: expiresAt,
    });

    if (error) {
      throw new Error(`Failed to store OTP challenge: ${error.message}`);
    }

    await this.sendAuthenticationTemplate({
      code,
      phoneE164,
    });
  }

  async verifyOtp(params: { code: string; phoneE164: string }): Promise<boolean> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('auth_otp_challenges')
      .select('id, code_hash, expires_at, attempts, consumed_at')
      .eq('phone_e164', params.phoneE164)
      .eq('channel', 'whatsapp')
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

    if (data.attempts >= 5) {
      throw new Error('Demasiados intentos. Pedí un código nuevo.');
    }

    if (new Date(data.expires_at).getTime() < Date.now()) {
      throw new Error('El código expiró. Pedí uno nuevo.');
    }

    const submittedHash = createHash('sha256').update(params.code.trim()).digest('hex');
    const isValid = submittedHash === data.code_hash;

    await client
      .from('auth_otp_challenges')
      .update({
        attempts: data.attempts + 1,
        consumed_at: isValid ? new Date().toISOString() : data.consumed_at,
      })
      .eq('id', data.id);

    return isValid;
  }

  private async sendAuthenticationTemplate(params: {
    code: string;
    phoneE164: string;
  }): Promise<void> {
    const accessToken =
      process.env.NEXOLIA_AUTH_WABA_ACCESS_TOKEN?.trim() ??
      process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim();
    const phoneNumberId = process.env.NEXOLIA_AUTH_WABA_PHONE_NUMBER_ID?.trim();
    const templateName =
      process.env.NEXOLIA_AUTH_OTP_TEMPLATE_NAME?.trim() ?? 'nexolia_auth_otp';
    const templateLanguage =
      process.env.NEXOLIA_AUTH_OTP_TEMPLATE_LANGUAGE?.trim() ?? 'es';

    if (!accessToken || !phoneNumberId) {
      if (process.env.NODE_ENV !== 'production') {
        console.info(
          `[auth-otp] Dev mode — WhatsApp OTP for ${params.phoneE164}: ${params.code}`,
        );
        return;
      }

      throw new Error('Platform WhatsApp auth is not configured on the API server.');
    }

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: normalizeWhatsAppRecipient(params.phoneE164),
          type: 'template',
          template: {
            name: templateName,
            language: { code: templateLanguage },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: params.code }],
              },
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [{ type: 'text', text: params.code }],
              },
            ],
          },
        }),
      },
    );

    const body = (await response.json()) as MetaSendResponse;

    if (!response.ok) {
      throw new Error(body.error?.message ?? `Meta OTP send failed with HTTP ${response.status}`);
    }
  }
}
