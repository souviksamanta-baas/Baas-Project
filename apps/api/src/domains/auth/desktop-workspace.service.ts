import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SupabaseService } from '../../supabase/supabase.service';

type DashboardPayload = {
  businessCenter: { id: string; name: string; timezone?: string } | null;
  metrics: {
    contacts: number;
    lowStockItems: number;
    messagesToday: number;
    openConversations: number;
    pendingFollowUps: number;
    products: number;
    weeklySalesCents: number;
  };
  organization: {
    id: string;
    name: string;
    navShortcut?: string | null;
    role: string;
    timezone: string;
  } | null;
  whatsappConnection?: { displayPhoneNumber?: string | null; status?: string };
  instagramConnection?: { igUsername?: string | null; status?: string };
  facebookConnection?: { pageName?: string | null; status?: string };
};

@Injectable()
export class DesktopWorkspaceService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async load(authorizationHeader: string | undefined, requestedOrganizationId?: string | null) {
    const accessToken = authorizationHeader?.replace(/^Bearer\s+/i, '').trim();
    if (!accessToken) {
      throw new UnauthorizedException('Iniciá sesión para continuar.');
    }

    const client = this.supabaseService.createUserClient(accessToken);
    const { data: userData, error: userError } = await client.auth.getUser(accessToken);
    if (userError || !userData.user) {
      throw new UnauthorizedException('La sesión no es válida.');
    }

    const user = userData.user;
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const displayName =
      stringValue(metadata.full_name) ||
      stringValue(metadata.name) ||
      user.email ||
      'Tu cuenta';

    const requestedId = isUuid(requestedOrganizationId) ? requestedOrganizationId : null;
    const { data: dashboardData, error: dashboardError } = await client.rpc('get_owner_dashboard', {
      p_organization_id: requestedId,
    });
    if (dashboardError || !dashboardData) {
      throw new UnauthorizedException('No pudimos abrir tu negocio.');
    }

    const dashboard = dashboardData as DashboardPayload;
    const organizationId = dashboard.organization?.id;
    const businessCenterId = dashboard.businessCenter?.id;
    if (!organizationId || !businessCenterId) {
      throw new UnauthorizedException('Tu cuenta todavía no tiene un negocio activo.');
    }
    if (requestedId && organizationId !== requestedId) {
      throw new UnauthorizedException('No pudimos abrir el negocio que tenés en el celular.');
    }

    const timeZone = dashboard.organization?.timezone || 'America/Argentina/Cordoba';
    const today = todayIso(timeZone);

    const [
      profile,
      products,
      conversations,
      messages,
      appointments,
      tasks,
      cash,
      invoices,
      quotes,
      purchases,
      purchaseLines,
      suppliers,
      arca,
      members,
      businessCenters,
      categoryLinks,
      lots,
      movements,
      license,
    ] = await Promise.all([
      this.one(client, 'organizations', organizationId, 'id, name, timezone, contact_email, contact_phone, address_line1, address_line2, city, province, postal_code, country, nav_shortcut'),
      this.many(
        client
          .from('inventory_items')
          .select(
            'id, quantity_on_hand, reorder_threshold, unit_code, products!inner(id, name, sku, description, unit_price_cents, is_active, metadata)',
          )
          .eq('organization_id', organizationId)
          .eq('business_center_id', businessCenterId)
          .eq('products.is_active', true)
          .limit(200),
      ),
      this.many(
        client
          .from('conversations')
          .select(
            'id, channel, customer_display_name, status, last_message_at, archived_at, pinned_at, contacts(display_name, phone_number, lead_status)',
          )
          .eq('organization_id', organizationId)
          .eq('business_center_id', businessCenterId)
          .is('deleted_at', null)
          .order('last_message_at', { ascending: false })
          .limit(80),
      ),
      this.many(
        client
          .from('conversation_messages')
          .select('conversation_id, direction, body, created_at')
          .eq('organization_id', organizationId)
          .eq('business_center_id', businessCenterId)
          .order('created_at', { ascending: false })
          .limit(200),
      ),
      this.many(
        client
          .from('appointments')
          .select('id, title, starts_at, ends_at, status, notes, business_center_id, contacts(display_name, phone_number)')
          .eq('organization_id', organizationId)
          .order('starts_at', { ascending: true })
          .limit(200),
      ),
      this.many(
        client
          .from('owner_tasks')
          .select('id, title, description, status, due_at, task_type, assigned_to_user_id, contacts(display_name)')
          .eq('organization_id', organizationId)
          .order('due_at', { ascending: true, nullsFirst: false })
          .limit(100),
      ),
      this.many(
        client
          .from('cash_ledger_entries')
          .select('id, entry_date, entry_type, amount_cents, concept, source')
          .eq('organization_id', organizationId)
          .eq('business_center_id', businessCenterId)
          .order('entry_date', { ascending: false })
          .limit(400),
      ),
      this.many(
        client
          .from('invoices')
          .select(
            'id, voucher_type, voucher_number, point_of_sale, issue_date, total_amount_cents, customer_name, customer_document_number, arca_status, cae, cae_expiration',
          )
          .eq('organization_id', organizationId)
          .order('issue_date', { ascending: false })
          .limit(80),
      ),
      this.many(
        client
          .from('sell_quotes')
          .select('id, status, draft, created_at')
          .eq('organization_id', organizationId)
          .eq('business_center_id', businessCenterId)
          .order('created_at', { ascending: false })
          .limit(80),
      ),
      this.many(
        client
          .from('purchases')
          .select('id, number, supplier, purchase_date, status, item_count, total_cents')
          .eq('organization_id', organizationId)
          .eq('business_center_id', businessCenterId)
          .order('created_at', { ascending: false })
          .limit(80),
      ),
      this.many(
        client
          .from('purchase_lines')
          .select('purchase_id, product_name, quantity, unit_code, line_total_cents')
          .eq('organization_id', organizationId)
          .limit(400),
      ),
      this.many(
        client
          .from('suppliers')
          .select('id, comercio, name, email, phone, notes, created_at')
          .eq('organization_id', organizationId)
          .order('comercio', { ascending: true })
          .limit(80),
      ),
      this.maybe(
        client
          .from('arca_accounts')
          .select('authorization_status, cuit, point_of_sale, tax_condition, environment, connected_at')
          .eq('organization_id', organizationId)
          .maybeSingle(),
      ),
      this.many(
        client
          .from('organization_members')
          .select('user_id, role')
          .eq('organization_id', organizationId)
          .limit(50),
      ),
      this.many(
        client
          .from('business_centers')
          .select('id, name, timezone, is_default')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('is_default', { ascending: false })
          .order('name', { ascending: true }),
      ),
      this.many(
        client
          .from('product_category_links')
          .select('product_id, product_categories!inner(name, organization_id)')
          .eq('product_categories.organization_id', organizationId)
          .limit(500),
      ),
      this.many(
        client
          .from('inventory_lots')
          .select('product_id, lot_code, remaining_quantity, unit_code, unit_cost_cents, received_at, products(name)')
          .eq('organization_id', organizationId)
          .eq('business_center_id', businessCenterId)
          .order('received_at', { ascending: false })
          .limit(80),
      ),
      this.many(
        client
          .from('inventory_movements')
          .select('product_id, movement_type, quantity_delta, unit_code, note, created_at, products(name)')
          .eq('organization_id', organizationId)
          .eq('business_center_id', businessCenterId)
          .order('created_at', { ascending: false })
          .limit(80),
      ),
      this.maybe(
        client
          .from('organizations')
          .select('license_status, licensed_until, billing_cycle, plans(display_name, slug)')
          .eq('id', organizationId)
          .maybeSingle(),
      ),
    ]);

    const openingCents = cash
      .filter((row) => String(row.entry_date) < today)
      .reduce((sum, row) => sum + signedCents(row), 0);
    const plan = embeddedRecord(license, 'plans');

    return {
      today,
      user: {
        displayName,
        email: user.email ?? '',
        id: user.id,
        phone: user.phone ?? '',
      },
      organization: {
        address: formatAddress(profile),
        email: stringValue(profile?.contact_email),
        id: organizationId,
        name: dashboard.organization?.name || stringValue(profile?.name) || 'Tu negocio',
        navShortcut: dashboard.organization?.navShortcut ?? null,
        phone: stringValue(profile?.contact_phone) || dashboard.whatsappConnection?.displayPhoneNumber || '',
        role: dashboard.organization?.role || 'owner',
        timezone: timeZone,
      },
      businessCenter: {
        id: businessCenterId,
        name: dashboard.businessCenter?.name || '',
      },
      metrics: dashboard.metrics,
      channels: {
        facebook: dashboard.facebookConnection ?? null,
        instagram: dashboard.instagramConnection ?? null,
        whatsapp: dashboard.whatsappConnection ?? null,
      },
      members: members.map((row) => ({
        role: String(row.role ?? ''),
        userId: String(row.user_id ?? ''),
      })),
      products,
      conversations,
      messages,
      appointments,
      tasks,
      cash,
      openingCents,
      invoices,
      quotes,
      purchases,
      purchaseLines,
      suppliers,
      arca,
      businessCenters,
      categoryLinks,
      lots,
      movements,
      license: license
        ? {
            cycle: stringValue(license.billing_cycle),
            plan: stringValue(plan?.display_name),
            slug: stringValue(plan?.slug),
            status: stringValue(license.license_status),
            until: stringValue(license.licensed_until),
          }
        : null,
    };
  }

  private async many(query: PromiseLike<{ data: unknown; error: { message: string } | null }>) {
    const { data, error } = await query;
    if (error || !Array.isArray(data)) return [] as Array<Record<string, unknown>>;
    return data as Array<Record<string, unknown>>;
  }

  private async one(
    client: SupabaseClient,
    table: string,
    id: string,
    columns: string,
  ): Promise<Record<string, unknown> | null> {
    const result = await client.from(table).select(columns).eq('id', id).maybeSingle();
    if (result.error || !result.data || typeof result.data !== 'object') return null;
    return result.data as unknown as Record<string, unknown>;
  }

  private async maybe(query: PromiseLike<{ data: unknown; error: { message: string } | null }>) {
    const { data, error } = await query;
    if (error || !data || Array.isArray(data) || typeof data !== 'object') return null;
    return data as unknown as Record<string, unknown>;
  }
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function embeddedRecord(row: Record<string, unknown> | null, key: string): Record<string, unknown> | null {
  if (!row) return null;
  const value = row[key];
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null;
  }
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function signedCents(row: Record<string, unknown>): number {
  const amount = Number(row.amount_cents) || 0;
  return row.entry_type === 'egreso' ? -amount : amount;
}

function todayIso(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      month: '2-digit',
      timeZone,
      year: 'numeric',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function formatAddress(profile: Record<string, unknown> | null): string {
  if (!profile) return '';
  return [profile.address_line1, profile.address_line2, profile.city, profile.province, profile.postal_code]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(', ');
}
