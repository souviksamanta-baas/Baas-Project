import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';

export const COPI_CHAT_RETENTION_DAYS = 14;

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

    const active = await this.findActiveSession({
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
      userId: params.userId,
    });
    if (active) {
      return active;
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

  async findActiveSession(params: {
    businessCenterId?: string;
    organizationId: string;
    userId: string;
  }): Promise<string | null> {
    const client = this.supabaseService.getServiceRoleClient();
    const sinceIso = retentionCutoffIso();

    let recentSessionQuery = client
      .from('copi_sessions')
      .select('id')
      .eq('organization_id', params.organizationId)
      .eq('user_id', params.userId)
      .gte('updated_at', sinceIso)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (params.businessCenterId) {
      recentSessionQuery = recentSessionQuery.eq('business_center_id', params.businessCenterId);
    }

    const { data: recentSession, error: recentError } = await recentSessionQuery.maybeSingle<{ id: string }>();
    if (recentError) {
      throw new Error(`Failed to find active Copi session: ${recentError.message}`);
    }
    if (recentSession?.id) {
      return recentSession.id;
    }

    // Fallback for sessions that still have in-window messages but stale updated_at.
    const { data: recentMessages, error: messageError } = await client
      .from('copi_messages')
      .select('session_id')
      .eq('organization_id', params.organizationId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(40);

    if (messageError) {
      throw new Error(`Failed to find active Copi session messages: ${messageError.message}`);
    }

    const sessionIds = Array.from(
      new Set((recentMessages ?? []).map((row) => row.session_id as string).filter(Boolean)),
    );
    if (sessionIds.length === 0) {
      return null;
    }

    let ownedQuery = client
      .from('copi_sessions')
      .select('id')
      .eq('organization_id', params.organizationId)
      .eq('user_id', params.userId)
      .in('id', sessionIds)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (params.businessCenterId) {
      ownedQuery = ownedQuery.eq('business_center_id', params.businessCenterId);
    }

    const { data: owned, error: ownedError } = await ownedQuery.maybeSingle<{ id: string }>();
    if (ownedError) {
      throw new Error(`Failed to resolve owned Copi session: ${ownedError.message}`);
    }

    return owned?.id ?? null;
  }

  async getActiveThread(params: {
    businessCenterId?: string;
    organizationId: string;
    userId: string;
  }): Promise<{
    messages: Array<{
      body: string;
      createdAt: string;
      id: string;
      role: 'owner' | 'assistant' | 'system';
    }>;
    sessionId: string | null;
  }> {
    const sessionId = await this.findActiveSession(params);
    if (!sessionId) {
      return { messages: [], sessionId: null };
    }

    const messages = await this.listMessages(sessionId, params.organizationId);
    return { messages, sessionId };
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

    const { error: touchError } = await client
      .from('copi_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', params.sessionId)
      .eq('organization_id', params.organizationId);

    if (touchError) {
      throw new Error(`Failed to refresh Copi session: ${touchError.message}`);
    }
  }

  async listMessages(
    sessionId: string,
    organizationId: string,
  ): Promise<
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
      .gte('created_at', retentionCutoffIso())
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

function retentionCutoffIso(now = new Date()): string {
  const cutoff = new Date(now.getTime() - COPI_CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  return cutoff.toISOString();
}
