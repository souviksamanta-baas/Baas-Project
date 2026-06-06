import { Injectable } from '@nestjs/common';

import { InventoryService, type InventoryProduct } from '../inventory/inventory.service';
import { WhatsAppOutboundMessageService } from '../whatsapp/whatsapp-outbound-message.service';
import { SupabaseService } from '../../supabase/supabase.service';

export interface HandleInboundSalesMessageParams {
  businessCenterId: string;
  conversationId: string;
  organizationId: string;
  sourceMessageId: string;
  textBody: string | null;
}

export interface SalesAiDraftResult {
  autoSendEligible: boolean;
  body: string;
  catalogContext: {
    matchedProducts: Array<{
      currency: string;
      id: string;
      name: string;
      sku: string | null;
      stockQuantity: number;
      unitPriceCents: number;
    }>;
    missingProductQuery: string | null;
  };
  draftType: 'quote' | 'reply';
  leadStatus: 'active' | 'cold' | 'new';
  reason: string;
}

interface BusinessCenterRow {
  ai_auto_send: boolean;
  business_hours: BusinessHoursSettings | null;
  id: string;
  timezone: string;
}

interface AiDraftRow {
  auto_send_eligible: boolean;
  business_center_id: string;
  conversation_id: string;
  edited_body: string | null;
  id: string;
  organization_id: string;
  reply_body: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'sent' | 'failed';
}

interface ConversationRow {
  business_center_id: string;
  external_contact_id: string;
  organization_id: string;
}

interface MembershipRow {
  role: 'owner' | 'staff';
}

interface BusinessHoursSettings {
  days?: number[];
  enabled?: boolean;
  end?: string;
  start?: string;
  timezone?: string;
}

const STOP_WORDS = new Set([
  'about',
  'available',
  'availability',
  'can',
  'cost',
  'could',
  'for',
  'have',
  'how',
  'much',
  'need',
  'please',
  'price',
  'quote',
  'stock',
  'the',
  'this',
  'with',
  'you',
]);

@Injectable()
export class SalesAiService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly inventoryService: InventoryService,
    private readonly whatsappOutboundMessageService: WhatsAppOutboundMessageService,
  ) {}

  async handleInboundMessage(params: HandleInboundSalesMessageParams): Promise<void> {
    if (!params.textBody?.trim()) {
      return;
    }

    const businessCenter = await this.getBusinessCenter({
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
    });
    const draft = await this.generateDraft({
      businessCenterId: params.businessCenterId,
      messageBody: params.textBody,
      organizationId: params.organizationId,
    });
    const persistedDraft = await this.insertDraft({
      businessCenterId: params.businessCenterId,
      conversationId: params.conversationId,
      draft,
      organizationId: params.organizationId,
      sourceMessageId: params.sourceMessageId,
    });

    await this.logDraftEvent({
      draftId: persistedDraft.id,
      details: {
        autoSendEligible: draft.autoSendEligible,
        decisionReason: draft.reason,
        draftType: draft.draftType,
      },
      eventType: 'draft_created',
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
    });

    if (
      businessCenter.ai_auto_send &&
      draft.autoSendEligible &&
      isWithinBusinessHours(businessCenter.business_hours, businessCenter.timezone)
    ) {
      await this.autoSendDraft(persistedDraft);
    }
  }

  async generateDraft(params: {
    businessCenterId?: string;
    messageBody: string;
    organizationId: string;
  }): Promise<SalesAiDraftResult> {
    const products = await this.inventoryService.listActiveProducts({
      businessCenterId: params.businessCenterId,
      organizationId: params.organizationId,
    });
    const matchedProducts = findMatchedProducts(params.messageBody, products);
    const wantsQuote = isQuoteRequest(params.messageBody);
    const wantsCatalogAnswer = wantsQuote || isCatalogQuestion(params.messageBody);

    if (matchedProducts.length === 0 && wantsCatalogAnswer) {
      return {
        autoSendEligible: false,
        body:
          "I don't see that item in our catalog yet. Let me confirm availability and pricing with the owner before quoting it.",
        catalogContext: {
          matchedProducts: [],
          missingProductQuery: params.messageBody.trim(),
        },
        draftType: wantsQuote ? 'quote' : 'reply',
        leadStatus: 'active',
        reason: 'catalog_question_without_verified_product',
      };
    }

    if (wantsQuote && matchedProducts.length > 0) {
      return {
        autoSendEligible: false,
        body: buildQuoteText(matchedProducts),
        catalogContext: {
          matchedProducts: matchedProducts.map(toCatalogContextProduct),
          missingProductQuery: null,
        },
        draftType: 'quote',
        leadStatus: 'active',
        reason: 'quote_requires_owner_review',
      };
    }

    if (matchedProducts.length > 0) {
      return {
        autoSendEligible: true,
        body: buildCatalogReply(matchedProducts[0]),
        catalogContext: {
          matchedProducts: matchedProducts.map(toCatalogContextProduct),
          missingProductQuery: null,
        },
        draftType: 'reply',
        leadStatus: 'active',
        reason: 'catalog_backed_reply',
      };
    }

    return {
      autoSendEligible: false,
      body:
        "Thanks for reaching out. I can help with availability, pricing, or a simple quote. Which product are you interested in?",
      catalogContext: {
        matchedProducts: [],
        missingProductQuery: null,
      },
      draftType: 'reply',
      leadStatus: 'new',
      reason: 'general_sales_follow_up',
    };
  }

  async approveDraft(params: {
    authorizationHeader: string | undefined;
    draftId: string;
    editedBody?: string;
  }): Promise<{ status: 'sent' }> {
    const draft = await this.getDraft(params.draftId);
    const userId = await this.assertMember({
      authorizationHeader: params.authorizationHeader,
      organizationId: draft.organization_id,
    });
    const sendBody = params.editedBody?.trim() || draft.reply_body;
    const conversation = await this.getConversation(draft.conversation_id);

    await this.updateDraft(params.draftId, {
      approved_at: new Date().toISOString(),
      approved_by: userId,
      decision_reason: params.editedBody?.trim() ? 'owner_edited_and_approved' : 'owner_approved',
      edited_body: params.editedBody?.trim() || null,
      status: 'approved',
    });
    await this.logDraftEvent({
      draftId: params.draftId,
      details: {
        edited: Boolean(params.editedBody?.trim()),
      },
      eventType: 'approved',
      businessCenterId: draft.business_center_id,
      organizationId: draft.organization_id,
    });

    try {
      await this.whatsappOutboundMessageService.sendTextMessage({
        body: sendBody,
        businessCenterId: draft.business_center_id,
        organizationId: draft.organization_id,
        recipientPhone: conversation.external_contact_id,
      });
      await this.updateDraft(params.draftId, {
        sent_at: new Date().toISOString(),
        status: 'sent',
      });
      await this.logDraftEvent({
        draftId: params.draftId,
        details: {
          source: 'owner_approval',
        },
        eventType: 'send_succeeded',
        businessCenterId: draft.business_center_id,
        organizationId: draft.organization_id,
      });

      return { status: 'sent' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown send error';
      await this.updateDraft(params.draftId, {
        error_message: message,
        failed_at: new Date().toISOString(),
        status: 'failed',
      });
      await this.logDraftEvent({
        draftId: params.draftId,
        details: {
          error: message,
          source: 'owner_approval',
        },
        eventType: 'send_failed',
        businessCenterId: draft.business_center_id,
        organizationId: draft.organization_id,
      });
      throw error;
    }
  }

  async rejectDraft(params: {
    authorizationHeader: string | undefined;
    draftId: string;
  }): Promise<{ status: 'rejected' }> {
    const draft = await this.getDraft(params.draftId);
    await this.assertMember({
      authorizationHeader: params.authorizationHeader,
      organizationId: draft.organization_id,
    });
    await this.updateDraft(params.draftId, {
      decision_reason: 'owner_rejected',
      rejected_at: new Date().toISOString(),
      status: 'rejected',
    });
    await this.logDraftEvent({
      draftId: params.draftId,
      details: {},
      eventType: 'rejected',
      businessCenterId: draft.business_center_id,
      organizationId: draft.organization_id,
    });

    return { status: 'rejected' };
  }

  private async autoSendDraft(draft: AiDraftRow): Promise<void> {
    const conversation = await this.getConversation(draft.conversation_id);
    await this.updateDraft(draft.id, {
      auto_send_attempted: true,
    });
    await this.logDraftEvent({
      draftId: draft.id,
      details: {},
      eventType: 'auto_send_attempted',
      businessCenterId: draft.business_center_id,
      organizationId: draft.organization_id,
    });

    try {
      await this.whatsappOutboundMessageService.sendTextMessage({
        body: draft.reply_body,
        businessCenterId: draft.business_center_id,
        organizationId: draft.organization_id,
        recipientPhone: conversation.external_contact_id,
      });
      await this.updateDraft(draft.id, {
        sent_at: new Date().toISOString(),
        status: 'sent',
      });
      await this.logDraftEvent({
        draftId: draft.id,
        details: {},
        eventType: 'auto_send_succeeded',
        businessCenterId: draft.business_center_id,
        organizationId: draft.organization_id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown auto-send error';
      await this.updateDraft(draft.id, {
        error_message: message,
        failed_at: new Date().toISOString(),
        status: 'failed',
      });
      await this.logDraftEvent({
        draftId: draft.id,
        details: {
          error: message,
        },
        eventType: 'auto_send_failed',
        businessCenterId: draft.business_center_id,
        organizationId: draft.organization_id,
      });
    }
  }

  private async getBusinessCenter(params: {
    businessCenterId: string;
    organizationId: string;
  }): Promise<BusinessCenterRow> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('business_centers')
      .select('id, ai_auto_send, business_hours, timezone')
      .eq('id', params.businessCenterId)
      .eq('organization_id', params.organizationId)
      .single<BusinessCenterRow>();

    if (error) {
      throw new Error(`Failed to load business center AI settings: ${error.message}`);
    }

    return data;
  }

  private async insertDraft(params: {
    businessCenterId: string;
    conversationId: string;
    draft: SalesAiDraftResult;
    organizationId: string;
    sourceMessageId: string;
  }): Promise<AiDraftRow> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('ai_drafts')
      .insert({
        auto_send_eligible: params.draft.autoSendEligible,
        business_center_id: params.businessCenterId,
        catalog_context: params.draft.catalogContext,
        conversation_id: params.conversationId,
        decision_reason: params.draft.reason,
        draft_type: params.draft.draftType,
        lead_status: params.draft.leadStatus,
        metadata: {
          generator: 'deterministic_sales_ai_v1',
        },
        organization_id: params.organizationId,
        reply_body: params.draft.body,
        source_message_id: params.sourceMessageId,
        status: 'pending_approval',
      })
      .select('id, organization_id, business_center_id, conversation_id, reply_body, edited_body, status, auto_send_eligible')
      .single<AiDraftRow>();

    if (error) {
      if (error.code === '23505') {
        return this.getDraftBySourceMessage({
          organizationId: params.organizationId,
          sourceMessageId: params.sourceMessageId,
        });
      }

      throw new Error(`Failed to persist AI draft: ${error.message}`);
    }

    return data;
  }

  private async getDraftBySourceMessage(params: {
    organizationId: string;
    sourceMessageId: string;
  }): Promise<AiDraftRow> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('ai_drafts')
      .select('id, organization_id, business_center_id, conversation_id, reply_body, edited_body, status, auto_send_eligible')
      .eq('organization_id', params.organizationId)
      .eq('source_message_id', params.sourceMessageId)
      .single<AiDraftRow>();

    if (error) {
      throw new Error(`Failed to load duplicate AI draft: ${error.message}`);
    }

    return data;
  }

  private async getDraft(draftId: string): Promise<AiDraftRow> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('ai_drafts')
      .select('id, organization_id, business_center_id, conversation_id, reply_body, edited_body, status, auto_send_eligible')
      .eq('id', draftId)
      .single<AiDraftRow>();

    if (error) {
      throw new Error(`Failed to load AI draft: ${error.message}`);
    }

    if (data.status !== 'pending_approval' && data.status !== 'failed') {
      throw new Error(`AI draft cannot be acted on while status is ${data.status}`);
    }

    return data;
  }

  private async getConversation(conversationId: string): Promise<ConversationRow> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data, error } = await client
      .from('conversations')
      .select('organization_id, business_center_id, external_contact_id')
      .eq('id', conversationId)
      .single<ConversationRow>();

    if (error) {
      throw new Error(`Failed to load AI draft conversation: ${error.message}`);
    }

    return data;
  }

  private async updateDraft(draftId: string, updates: Record<string, unknown>): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client.from('ai_drafts').update(updates).eq('id', draftId);

    if (error) {
      throw new Error(`Failed to update AI draft: ${error.message}`);
    }
  }

  private async logDraftEvent(params: {
    businessCenterId: string;
    details: Record<string, unknown>;
    draftId: string;
    eventType:
      | 'approved'
      | 'auto_send_attempted'
      | 'auto_send_failed'
      | 'auto_send_succeeded'
      | 'draft_created'
      | 'rejected'
      | 'send_failed'
      | 'send_succeeded';
    organizationId: string;
  }): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client.from('ai_draft_events').insert({
      ai_draft_id: params.draftId,
      business_center_id: params.businessCenterId,
      details: params.details,
      event_type: params.eventType,
      organization_id: params.organizationId,
    });

    if (error) {
      throw new Error(`Failed to log AI draft event: ${error.message}`);
    }
  }

  private async assertMember(params: {
    authorizationHeader: string | undefined;
    organizationId: string;
  }): Promise<string> {
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

    return userData.user.id;
  }
}

function isCatalogQuestion(messageBody: string): boolean {
  const normalized = messageBody.toLocaleLowerCase();
  return /\b(price|precio|cost|cuesta|stock|available|availability|disponible|hay)\b/.test(
    normalized,
  );
}

function isQuoteRequest(messageBody: string): boolean {
  const normalized = messageBody.toLocaleLowerCase();
  return /\b(quote|quotation|cotizacion|cotización|presupuesto|estimate)\b/.test(normalized);
}

function findMatchedProducts(
  messageBody: string,
  products: InventoryProduct[],
): InventoryProduct[] {
  const normalizedBody = normalizeSearchText(messageBody);
  const searchableTokens = normalizedBody
    .split(' ')
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

  return products
    .map((product) => ({
      product,
      score: getProductScore(product, normalizedBody, searchableTokens),
    }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((match) => match.product);
}

function getProductScore(
  product: InventoryProduct,
  normalizedBody: string,
  searchableTokens: string[],
): number {
  const productName = normalizeSearchText(product.name);
  const sku = normalizeSearchText(product.sku ?? '');
  let score = 0;

  if (normalizedBody.includes(productName)) {
    score += 10;
  }

  if (sku && normalizedBody.includes(sku)) {
    score += 8;
  }

  for (const token of searchableTokens) {
    if (productName.includes(token) || sku.includes(token)) {
      score += 2;
    }
  }

  return score;
}

function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildCatalogReply(product: InventoryProduct): string {
  const stockText =
    product.stockQuantity > 0
      ? `${product.stockQuantity} in stock`
      : 'currently out of stock';

  return [
    `${product.name} is ${stockText}.`,
    `Price: ${formatMoney(product.unitPriceCents, product.currency)}.`,
    product.stockQuantity > 0
      ? 'Would you like me to reserve it or prepare a quote?'
      : 'I can check restock timing for you.',
  ].join(' ');
}

function buildQuoteText(products: InventoryProduct[]): string {
  const lines = products.map((product) => {
    return `- 1 x ${product.name}: ${formatMoney(product.unitPriceCents, product.currency)} (${product.stockQuantity} available)`;
  });
  const totalByCurrency = products.reduce<Record<string, number>>((totals, product) => {
    totals[product.currency] = (totals[product.currency] ?? 0) + product.unitPriceCents;
    return totals;
  }, {});
  const totals = Object.entries(totalByCurrency).map(([currency, cents]) => {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  });

  return [
    'Quote:',
    ...lines,
    `Total: ${totals.join(' + ')}`,
    'Please confirm quantities before payment or delivery.',
  ].join('\n');
}

function formatMoney(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

function toCatalogContextProduct(product: InventoryProduct): SalesAiDraftResult['catalogContext']['matchedProducts'][number] {
  return {
    currency: product.currency,
    id: product.id,
    name: product.name,
    sku: product.sku,
    stockQuantity: product.stockQuantity,
    unitPriceCents: product.unitPriceCents,
  };
}

export function isWithinBusinessHours(
  businessHours: BusinessHoursSettings | null,
  organizationTimezone: string,
  now = new Date(),
): boolean {
  if (!businessHours?.enabled) {
    return true;
  }

  if (!isTimeValue(businessHours.start) || !isTimeValue(businessHours.end)) {
    return false;
  }

  const timezone = businessHours.timezone || organizationTimezone || 'UTC';
  const localTime = getLocalTimeParts(now, timezone);
  const allowedDays = businessHours.days?.length ? businessHours.days : [1, 2, 3, 4, 5];

  if (!allowedDays.includes(localTime.day)) {
    return false;
  }

  const startMinutes = toMinutes(businessHours.start);
  const endMinutes = toMinutes(businessHours.end);

  if (startMinutes === endMinutes) {
    return false;
  }

  if (startMinutes < endMinutes) {
    return localTime.minutes >= startMinutes && localTime.minutes < endMinutes;
  }

  return localTime.minutes >= startMinutes || localTime.minutes < endMinutes;
}

function getLocalTimeParts(now: Date, timezone: string): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    timeZone: timezone,
    weekday: 'short',
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? 'Mon';
  const hourValue = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  const hour = hourValue === 24 ? 0 : hourValue;

  return {
    day: weekdayToNumber(weekday),
    minutes: hour * 60 + minute,
  };
}

function weekdayToNumber(weekday: string): number {
  const normalized = weekday.slice(0, 3).toLocaleLowerCase();
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(normalized);
}

function isTimeValue(value: string | undefined): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map((part) => Number.parseInt(part, 10));
  return hours * 60 + minutes;
}
