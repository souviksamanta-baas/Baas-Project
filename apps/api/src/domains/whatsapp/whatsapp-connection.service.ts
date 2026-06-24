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

interface MembershipRow {
  role: 'owner' | 'staff';
}

interface MetaPhoneNumberResponse {
  display_phone_number?: string;
  verified_name?: string;
  error?: {
    message?: string;
  };
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

    return this.toSummary(data);
  }

  async registerConnection(params: {
    authorizationHeader: string | undefined;
    displayPhoneNumber: string;
    organizationId: string;
    phoneNumberId: string;
    wabaId?: string;
  }): Promise<WhatsAppConnectionSummary> {
    await this.assertOwner({
      authorizationHeader: params.authorizationHeader,
      organizationId: params.organizationId,
    });

    const businessCenterId = await this.getDefaultBusinessCenterId(params.organizationId);
    const checkedAt = new Date().toISOString();
    const accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim();
    let connectionStatus: WhatsAppConnectionStatus = 'pending';
    let verifiedAt: string | null = null;
    let lastError: string | null = null;
    let displayPhoneNumber = params.displayPhoneNumber.trim();

    if (!accessToken) {
      lastError = 'WHATSAPP_CLOUD_ACCESS_TOKEN is not configured on the API server.';
    } else {
      const verification = await this.verifyPhoneNumberWithMeta({
        accessToken,
        phoneNumberId: params.phoneNumberId.trim(),
      });

      if (verification.errorMessage) {
        connectionStatus = 'error';
        lastError = verification.errorMessage;
      } else {
        connectionStatus = 'connected';
        verifiedAt = checkedAt;
        displayPhoneNumber = verification.displayPhoneNumber ?? displayPhoneNumber;
      }
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('whatsapp_config')
      .upsert(
        {
          organization_id: params.organizationId,
          business_center_id: businessCenterId,
          phone_number_id: params.phoneNumberId.trim(),
          waba_id: params.wabaId?.trim() || null,
          display_phone_number: displayPhoneNumber,
          access_token_encrypted: accessToken ?? null,
          connection_status: connectionStatus,
          verified_at: verifiedAt,
          last_status_check_at: checkedAt,
          last_error: lastError,
        },
        {
          onConflict: 'organization_id',
        },
      )
      .select(
        'phone_number_id, display_phone_number, connection_status, verified_at, last_status_check_at, last_error',
      )
      .single<WhatsAppConnectionRecord>();

    if (error) {
      throw new Error(`Failed to register WhatsApp connection: ${error.message}`);
    }

    return this.toSummary(data);
  }

  private async verifyPhoneNumberWithMeta(params: {
    accessToken: string;
    phoneNumberId: string;
  }): Promise<{ displayPhoneNumber: string | null; errorMessage: string | null }> {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${params.phoneNumberId}?fields=display_phone_number,verified_name`,
      {
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
        },
      },
    );

    const body = (await response.json()) as MetaPhoneNumberResponse;

    if (!response.ok) {
      return {
        displayPhoneNumber: null,
        errorMessage: body.error?.message ?? `Meta verification failed with HTTP ${response.status}`,
      };
    }

    return {
      displayPhoneNumber: body.display_phone_number ?? null,
      errorMessage: null,
    };
  }

  private async assertOwner(params: {
    authorizationHeader: string | undefined;
    organizationId: string;
  }): Promise<void> {
    const token = params.authorizationHeader?.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      throw new Error('Missing bearer token');
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data: userData, error: userError } = await client.auth.getUser(token);

    if (userError || !userData.user) {
      throw new Error('Invalid bearer token');
    }

    const { data, error } = await client
      .from('organization_members')
      .select('role')
      .eq('organization_id', params.organizationId)
      .eq('user_id', userData.user.id)
      .single<MembershipRow>();

    if (error || !data) {
      throw new Error('User is not a member of this organization');
    }

    if (data.role !== 'owner') {
      throw new Error('Only organization owners can register WhatsApp connections');
    }
  }

  private async getDefaultBusinessCenterId(organizationId: string): Promise<string> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('business_centers')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_default', true)
      .eq('is_active', true)
      .single<{ id: string }>();

    if (error) {
      throw new Error(`Failed to load default business center: ${error.message}`);
    }

    return data.id;
  }

  private toSummary(data: WhatsAppConnectionRecord): WhatsAppConnectionSummary {
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
