import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class CopiSessionService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async ensureSession(params: {
    businessCenterId: string;
    organizationId: string;
    sessionId?: string;
    userId: string;
  }): Promise<string> {
    if (params.sessionId) {
      const existing = await this.getSession(params.sessionId, params.organizationId, params.userId);
      if (existing) {
        return existing;
      }
    }

    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('copi_sessions')
      .insert({
        business_center_id: params.businessCenterId,
        organization_id: params.organizationId,
        user_id: params.userId,
      })
      .select('id')
      .single<{ id: string }>();

    if (error) {
      throw new Error(`Failed to create Copi session: ${error.message}`);
    }

    return data.id;
  }

  async appendMessage(params: {
    body: string;
    metadata?: Record<string, unknown>;
    organizationId: string;
    role: 'owner' | 'assistant' | 'system';
    sessionId: string;
    tokenUsage?: Record<string, unknown>;
    toolsUsed?: string[];
  }): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client.from('copi_messages').insert({
      body: params.body,
      metadata: params.metadata ?? {},
      organization_id: params.organizationId,
      role: params.role,
      session_id: params.sessionId,
      token_usage: params.tokenUsage ?? {},
      tools_used: params.toolsUsed ?? [],
    });

    if (error) {
      throw new Error(`Failed to persist Copi message: ${error.message}`);
    }
  }

  async listMessages(sessionId: string, organizationId: string): Promise<
    Array<{
      body: string;
      createdAt: string;
      id: string;
      role: 'owner' | 'assistant' | 'system';
    }>
  > {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('copi_messages')
      .select('id, role, body, created_at')
      .eq('session_id', sessionId)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to load Copi messages: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      body: row.body as string,
      createdAt: row.created_at as string,
      id: row.id as string,
      role: row.role as 'owner' | 'assistant' | 'system',
    }));
  }

  private async getSession(
    sessionId: string,
    organizationId: string,
    userId: string,
  ): Promise<string | null> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('copi_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .maybeSingle<{ id: string }>();

    if (error) {
      throw new Error(`Failed to load Copi session: ${error.message}`);
    }

    return data?.id ?? null;
  }
}
