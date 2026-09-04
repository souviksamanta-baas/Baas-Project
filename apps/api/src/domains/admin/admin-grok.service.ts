import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import {
  assertNexoliaStaff,
  writeAdminAudit,
} from './admin-auth.helper';
import { AdminLeadsService } from './admin-leads.service';
import {
  AdminOrgsService,
  AdminPaymentsService,
  AdminPlansService,
} from './admin-orgs.service';

interface GrokToolCall {
  arguments: Record<string, unknown>;
  name: string;
}

@Injectable()
export class AdminGrokService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly leadsService: AdminLeadsService,
    private readonly orgsService: AdminOrgsService,
    private readonly plansService: AdminPlansService,
    private readonly paymentsService: AdminPaymentsService,
  ) {}

  async chat(params: {
    authorizationHeader: string | undefined;
    message: string;
  }): Promise<{ reply: string; toolResults?: unknown[] }> {
    const staff = await assertNexoliaStaff(
      this.supabaseService,
      params.authorizationHeader,
    );

    const apiKey = process.env.XAI_API_KEY ?? process.env.GROK_API_KEY;
    const lower = params.message.toLowerCase();

    // Deterministic staff shortcuts when no LLM key is configured
    if (!apiKey) {
      return this.handleHeuristic(params.authorizationHeader, params.message, lower);
    }

    const system = `Sos el asistente de staff de Nexolia (admin.nexolia.com.ar).
Respondé en español rioplatense, breve y accionable.
Podés sugerir acciones: listar leads, KPIs, confirmar pagos, convertir leads.
No inventes IDs. Si falta un dato, pedilo.`;

    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.XAI_MODEL ?? 'grok-2-latest',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: params.message },
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Grok API error: ${response.status} ${text}`);
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const reply =
        json.choices?.[0]?.message?.content?.trim() ||
        'No pude generar una respuesta.';

      await writeAdminAudit({
        action: 'grok.chat',
        actorStaffId: staff.userId,
        entityType: 'grok',
        payload: { message: params.message.slice(0, 500) },
        supabaseService: this.supabaseService,
        via: 'grok',
      });

      // Still run heuristics if the user clearly asked for an action
      if (
        /kpi|dashboard|lead|pago|confirm|convert|plan/i.test(lower)
      ) {
        const heuristic = await this.handleHeuristic(
          params.authorizationHeader,
          params.message,
          lower,
        );
        return {
          reply: `${reply}\n\n---\n${heuristic.reply}`,
          toolResults: heuristic.toolResults,
        };
      }

      return { reply };
    } catch {
      return this.handleHeuristic(params.authorizationHeader, params.message, lower);
    }
  }

  private async handleHeuristic(
    authorizationHeader: string | undefined,
    message: string,
    lower: string,
  ): Promise<{ reply: string; toolResults?: unknown[] }> {
    if (/kpi|dashboard|métrica|metrica|resumen/.test(lower)) {
      const { AdminDashboardService } = await import('./admin-orgs.service');
      const dash = new AdminDashboardService(this.supabaseService);
      const kpis = await dash.getKpis(authorizationHeader);
      return {
        reply: `KPIs actuales:\n• Licencias activas: ${kpis.activeLicenses}\n• En prueba: ${kpis.trialLicenses}\n• Pagos por confirmar: ${kpis.pendingPayments}\n• Por vencer (14d): ${kpis.expiringSoon}\n• Leads nuevos: ${kpis.newLeads}`,
        toolResults: [kpis],
      };
    }

    if (/lead|prospect/.test(lower) && /list|mostr|ver|cuánt|cuant/.test(lower)) {
      const leads = await this.leadsService.listLeads(authorizationHeader);
      const newest = leads.slice(0, 5);
      return {
        reply: `Hay ${leads.length} leads. Últimos: ${newest
          .map((l: { email: string; status: string }) => `${l.email} (${l.status})`)
          .join(', ') || 'ninguno'}.`,
        toolResults: newest,
      };
    }

    if (/plan/.test(lower) && /list|mostr|ver|precio/.test(lower)) {
      const plans = await this.plansService.listPlans(authorizationHeader);
      return {
        reply: plans
          .map(
            (p: {
              display_name: string;
              price_ars_monthly: number;
              slug: string;
            }) =>
              `• ${p.display_name} (${p.slug}): $${Number(p.price_ars_monthly).toLocaleString('es-AR')}/mes`,
          )
          .join('\n') || 'No hay planes.',
        toolResults: plans,
      };
    }

    if (/pago.*pend|pend.*pago|confirmar pago/.test(lower)) {
      const pending = await this.paymentsService.listPending(authorizationHeader);
      return {
        reply: `Pagos pendientes: ${pending.length}. Usá el panel de Organizaciones o pasame el paymentId para confirmar.`,
        toolResults: pending.slice(0, 10),
      };
    }

    void message;
    return {
      reply:
        'Puedo ayudarte con KPIs, listar leads/planes, ver pagos pendientes y guiarte para convertir un lead. Pedime, por ejemplo: "mostrá los KPIs".',
    };
  }

  /** Reserved for future tool-calling expansion */
  async executeTool(
    authorizationHeader: string | undefined,
    call: GrokToolCall,
  ): Promise<unknown> {
    switch (call.name) {
      case 'list_leads':
        return this.leadsService.listLeads(authorizationHeader);
      case 'list_plans':
        return this.plansService.listPlans(authorizationHeader);
      case 'list_orgs':
        return this.orgsService.listOrganizations(authorizationHeader);
      default:
        return { error: `Unknown tool: ${call.name}` };
    }
  }
}
