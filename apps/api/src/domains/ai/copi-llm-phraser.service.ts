import { Injectable, Logger } from '@nestjs/common';

import { buildGreetingReply, hasGreeting, isUnclearCopiQuestion, unclearCopiReply } from './copi-intent-router';
import { resolveCopiModel } from './copi-model';
import {
  collectProductsFromToolResults,
  ensureCopiProductLinks,
} from './copi-product-link.util';
import type { CopiTokenUsage, CopiToolResult } from './copi.types';
import { CopiPolicyService } from './copi-policy.service';
import { OrganizationLlmCredentialsService } from './organization-llm-credentials.service';
import { buildCopiSystemPrompt } from './prompts/copi-prompt-composer';

@Injectable()
export class CopiLlmPhraserService {
  private readonly logger = new Logger(CopiLlmPhraserService.name);

  constructor(
    private readonly policyService: CopiPolicyService,
    private readonly llmCredentials: OrganizationLlmCredentialsService,
  ) {}

  async phraseAnswer(params: {
    enabled: boolean;
    history?: Array<{ body: string; role: 'owner' | 'assistant' | 'system' }>;
    locale: string;
    organizationId: string;
    ownerDisplayName?: string | null;
    ownerNotes?: string | null;
    question: string;
    tier?: 'basic' | 'pro';
    toolResults: CopiToolResult[];
  }): Promise<{ answer: string; tokenUsage: CopiTokenUsage }> {
    const alreadyGreeted = sessionAlreadyGreeted(params.history ?? []);
    const withLinks = (answer: string): string =>
      ensureCopiProductLinks(answer, collectProductsFromToolResults(params.toolResults));

    if (!params.enabled) {
      return {
        answer: withLinks(
          buildTemplateAnswer(
            params.question,
            params.toolResults,
            alreadyGreeted,
            params.ownerDisplayName,
          ),
        ),
        tokenUsage: this.policyService.emptyUsage(),
      };
    }

    const apiKey = await this.llmCredentials.getApiKeyForOrganization(params.organizationId);
    if (!apiKey) {
      this.logger.warn(
        'Copi phraser is using canned templates because no OpenAI API key is available. Natural replies require OPENAI_API_KEY or a provisioned org key.',
      );
      return {
        answer: withLinks(
          buildTemplateAnswer(
            params.question,
            params.toolResults,
            alreadyGreeted,
            params.ownerDisplayName,
          ),
        ),
        tokenUsage: this.policyService.emptyUsage(),
      };
    }

    const recentHistory = (params.history ?? []).slice(-6);
    const inputText = JSON.stringify({
      alreadyGreetedInSession: alreadyGreeted,
      history: recentHistory,
      locale: params.locale,
      ownerDisplayName: params.ownerDisplayName ?? null,
      ownerNotes: params.ownerNotes ?? null,
      question: params.question,
      toolResults: params.toolResults.map((result) => ({
        key: result.key,
        payload: result.payload,
        summary: result.summary,
      })),
    });

    const estimatedInput = this.policyService.estimateTokens(inputText);
    const budgetDecision = this.policyService.enforceTokenBudget({
      estimatedInputTokens: estimatedInput,
      estimatedOutputTokens: 500,
      // Pro orgs must not be capped by the Basic token budget (phraser used to hardcode basic).
      tier: params.tier ?? 'basic',
    });

    if (budgetDecision === 'policy_denied') {
      this.logger.warn(
        `Copi phraser skipped OpenAI due to Basic token budget (est. input=${estimatedInput}).`,
      );
      return {
        answer: 'Tu consulta supera el límite del plan Basic. Probá una pregunta más corta o activá Copi Pro.',
        tokenUsage: { inputTokens: estimatedInput, outputTokens: 0 },
      };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        body: JSON.stringify({
          max_tokens: 500,
          messages: [
            {
              content: buildCopiSystemPrompt('phraser'),
              role: 'system',
            },
            {
              content: inputText,
              role: 'user',
            },
          ],
          model: resolveCopiModel('phrase'),
          temperature: 0.35,
        }),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        this.logger.error(
          `Copi phraser OpenAI request failed (${response.status} ${response.statusText}); falling back to templates. ${errorBody.slice(0, 500)}`,
        );
        return {
          answer: withLinks(
            buildTemplateAnswer(
              params.question,
              params.toolResults,
              alreadyGreeted,
              params.ownerDisplayName,
            ),
          ),
          tokenUsage: this.policyService.emptyUsage(),
        };
      }

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const rawAnswer =
        body.choices?.[0]?.message?.content?.trim() ||
        buildTemplateAnswer(
          params.question,
          params.toolResults,
          alreadyGreeted,
          params.ownerDisplayName,
        );

      return {
        answer: withLinks(rawAnswer),
        tokenUsage: {
          inputTokens: body.usage?.prompt_tokens ?? estimatedInput,
          outputTokens: body.usage?.completion_tokens ?? 0,
        },
      };
    } catch (error) {
      this.logger.error(
        `Copi phraser OpenAI request threw; falling back to templates. ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        answer: withLinks(
          buildTemplateAnswer(
            params.question,
            params.toolResults,
            alreadyGreeted,
            params.ownerDisplayName,
          ),
        ),
        tokenUsage: this.policyService.emptyUsage(),
      };
    }
  }

  /**
   * Drafts the exact WhatsApp text to send to a customer (Argentine Spanish),
   * using conversation + inventory tool facts. Returns only the message body.
   */
  async phraseCustomerWhatsAppReply(params: {
    enabled: boolean;
    organizationId: string;
    question: string;
    tier?: 'basic' | 'pro';
    toolResults: CopiToolResult[];
  }): Promise<{ body: string; tokenUsage: CopiTokenUsage }> {
    const fallback = fallbackCustomerWhatsAppReply(params.toolResults);

    if (!params.enabled) {
      return { body: fallback, tokenUsage: this.policyService.emptyUsage() };
    }

    const apiKey = await this.llmCredentials.getApiKeyForOrganization(params.organizationId);
    if (!apiKey) {
      this.logger.warn(
        'Copi customer-reply draft is using a tool-based fallback because no OpenAI API key is available.',
      );
      return { body: fallback, tokenUsage: this.policyService.emptyUsage() };
    }

    const inputText = JSON.stringify({
      locale: 'es-AR',
      ownerRequest: params.question,
      task: 'customer_whatsapp_reply',
      toolResults: params.toolResults.map((result) => ({
        key: result.key,
        payload: result.payload,
        summary: result.summary,
      })),
    });

    const estimatedInput = this.policyService.estimateTokens(inputText);
    const budgetDecision = this.policyService.enforceTokenBudget({
      estimatedInputTokens: estimatedInput,
      estimatedOutputTokens: 400,
      tier: params.tier ?? 'basic',
    });
    if (budgetDecision === 'policy_denied') {
      return { body: fallback, tokenUsage: { inputTokens: estimatedInput, outputTokens: 0 } };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        body: JSON.stringify({
          max_tokens: 400,
          messages: [
            {
              content: [
                'Sos Copi. Redactás el mensaje EXACTO que el negocio enviará al cliente por WhatsApp.',
                'Idioma: español rioplatense (Argentina). Natural, claro, breve.',
                'Usá SOLO hechos de toolResults (hilo del chat + productos/stock/precios). No inventes stock ni precios.',
                'Si hay productos relevantes, mencionalos con stock y precio cuando estén en toolResults.',
                'Si no hay match de productos, pedí una aclaración amable sin inventar catálogo.',
                'NO escribas para el dueño. NO digas “te propongo” ni “¿confirmo?” ni “¿lo envío?”.',
                'NO ofrezcas crear tareas, presupuestos ni otras acciones internas.',
                'NO uses markdown de productos [[product:...]].',
                'Devolvé ÚNICAMENTE el texto del mensaje al cliente, sin comillas envolventes ni prefijos.',
              ].join('\n'),
              role: 'system',
            },
            {
              content: inputText,
              role: 'user',
            },
          ],
          model: resolveCopiModel('whatsapp_draft'),
          temperature: 0.4,
        }),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        this.logger.error(
          `Copi customer-reply OpenAI failed (${response.status}); using fallback. ${errorBody.slice(0, 400)}`,
        );
        return { body: fallback, tokenUsage: this.policyService.emptyUsage() };
      }

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const drafted = body.choices?.[0]?.message?.content?.trim() || fallback;
      return {
        body: drafted.replace(/^['«"]+|['»"]+$/g, '').trim() || fallback,
        tokenUsage: {
          inputTokens: body.usage?.prompt_tokens ?? estimatedInput,
          outputTokens: body.usage?.completion_tokens ?? 0,
        },
      };
    } catch (error) {
      this.logger.error(
        `Copi customer-reply OpenAI threw; using fallback. ${error instanceof Error ? error.message : String(error)}`,
      );
      return { body: fallback, tokenUsage: this.policyService.emptyUsage() };
    }
  }
}

function fallbackCustomerWhatsAppReply(toolResults: CopiToolResult[]): string {
  const findProduct = toolResults.find((result) => result.key === 'find_product');
  const products = Array.isArray(findProduct?.payload?.products)
    ? (findProduct?.payload?.products as Array<{
        name?: string;
        quantityOnHand?: number;
        unitPriceCents?: number;
      }>)
    : [];
  if (products.length > 0) {
    const lines = products.slice(0, 8).map((product) => {
      const name = String(product.name ?? 'Producto').trim();
      const stock =
        typeof product.quantityOnHand === 'number' ? `${product.quantityOnHand} u.` : 'stock n/d';
      const price =
        typeof product.unitPriceCents === 'number'
          ? `$${(product.unitPriceCents / 100).toLocaleString('es-AR', {
              maximumFractionDigits: 2,
              minimumFractionDigits: 0,
            })}`
          : '';
      return `• ${name} — ${stock}${price ? ` — ${price}` : ''}`;
    });
    return ['¡Hola! Según nuestro stock:', ...lines, '¿Te interesa alguno?'].join('\n');
  }

  return '¡Hola! Gracias por tu mensaje. Enseguida te paso la información que pediste.';
}

function sessionAlreadyGreeted(
  history: Array<{ body: string; role: 'owner' | 'assistant' | 'system' }>,
): boolean {
  return history.some((message) => {
    if (message.role !== 'assistant') {
      return false;
    }

    return /¡?(hola|buen d[ií]a|buenas tardes|buenas noches)/i.test(message.body);
  });
}

function buildTemplateAnswer(
  question: string,
  toolResults: CopiToolResult[],
  alreadyGreeted: boolean,
  ownerDisplayName?: string | null,
): string {
  const body = toolResults.map((result) => result.summary).join('\n\n');
  if (!body) {
    if (isUnclearCopiQuestion(question)) {
      return unclearCopiReply();
    }
    if (alreadyGreeted || !hasGreeting(question)) {
      return 'No encontré datos para esa consulta. Podés preguntarme por atención del día, ventas, stock, vencimientos de lote, conversaciones o seguimientos.';
    }
  }

  if (alreadyGreeted || !hasGreeting(question)) {
    return body;
  }

  const greeting = buildGreetingReply(question, new Date(), ownerDisplayName);
  return [greeting, body].filter(Boolean).join('\n\n');
}
