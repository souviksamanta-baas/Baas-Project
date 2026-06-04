import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';

export type WhatsAppConnectionStatus = 'pending' | 'connected' | 'error' | 'disabled';

export interface WhatsAppConnectionSummary {
  displayPhoneNumber: string | null;
  lastError: string | null;
  lastStatusCheckAt: string | null;
  phoneNumberId: string;
  status: WhatsAppConnectionStatus;
  verifiedAt: string | null;
}

interface WhatsAppConnectionRecord {
  display_phone_number: string | null;
  last_error: string | null;
  last_status_check_at: string | null;
  phone_number_id: string;
  connection_status: WhatsAppConnectionStatus;
  verified_at: string | null;
}

@Injectable()
export class WhatsAppConnectionService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getConnectionByPhoneNumberId(
    phoneNumberId: string,
  ): Promise<WhatsAppConnectionSummary | null> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('whatsapp_config')
      .select(
        'phone_number_id, display_phone_number, connection_status, verified_at, last_status_check_at, last_error',
      )
      .eq('phone_number_id', phoneNumberId)
      .maybeSingle<WhatsAppConnectionRecord>();

    if (error) {
      throw new Error(`Failed to load WhatsApp connection: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return {
      displayPhoneNumber: data.display_phone_number,
      lastError: data.last_error,
      lastStatusCheckAt: data.last_status_check_at,
      phoneNumberId: data.phone_number_id,
      status: data.connection_status,
      verifiedAt: data.verified_at,
    };
  }
}
