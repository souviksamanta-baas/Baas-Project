import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
const rlsTestPath = join(process.cwd(), 'supabase', 'tests', 'rls_cross_tenant.sql');

/**
 * Tenant-scoped tables that must appear in the cross-tenant SQL harness.
 * Keep in sync with supabase/tests/rls_cross_tenant.sql coverage.
 */
const tenantTables = [
  'organizations',
  'organization_members',
  'organization_verticals',
  'business_centers',
  'business_center_members',
  'contacts',
  'conversations',
  'conversation_messages',
  'products',
  'product_categories',
  'product_category_links',
  'suppliers',
  'purchases',
  'purchase_lines',
  'inventory_items',
  'inventory_lots',
  'inventory_movements',
  'inventory_transformations',
  'owner_tasks',
  'owner_notifications',
  'owner_device_tokens',
  'ai_drafts',
  'ai_draft_events',
  'appointments',
  'sell_quotes',
  'invoices',
  'cash_ledger_entries',
  'copi_sessions',
  'copi_messages',
  'copi_action_proposals',
  'pos_sale_receipts',
];

/**
 * Service-role-only tables: RLS enabled+forced, privileges revoked from
 * anon/authenticated, and referenced in the RLS SQL harness.
 */
const serviceOnlyTables = [
  'whatsapp_config',
  'whatsapp_message_events',
  'instagram_config',
  'instagram_message_events',
  'facebook_message_events',
  'arca_accounts',
  'organization_llm_credentials',
  'auth_otp_challenges',
  'auth_identity_merge_challenges',
  'browser_session_challenges',
  'invoice_issuance_locks',
  'app_startup_samples',
];

const failures = [];

const migrationFiles = (await readdir(migrationsDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
  .map((entry) => entry.name)
  .sort();
const migrationSql = (
  await Promise.all(
    migrationFiles.map(async (fileName) => readFile(join(migrationsDir, fileName), 'utf8')),
  )
).join('\n');
const rlsTestSql = await readFile(rlsTestPath, 'utf8');

const discoveredTables = [
  ...new Set(
    [...migrationSql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi)].map(
      (match) => match[1],
    ),
  ),
].sort();

const listedTables = new Set([...tenantTables, ...serviceOnlyTables]);
for (const table of discoveredTables) {
  if (!hasMigrationClause(migrationSql, table, 'enable row level security')) {
    failures.push(`public.${table} does not enable row level security in migrations`);
  }
  if (!hasMigrationClause(migrationSql, table, 'force row level security')) {
    failures.push(`public.${table} does not force row level security in migrations`);
  }
}

for (const table of tenantTables) {
  if (!discoveredTables.includes(table)) {
    failures.push(`tenant inventory lists missing table public.${table}`);
  }
  if (!containsTableReference(rlsTestSql, table)) {
    failures.push(`rls_cross_tenant.sql does not reference public.${table}`);
  }
}

for (const table of serviceOnlyTables) {
  if (!discoveredTables.includes(table)) {
    failures.push(`service-only inventory lists missing table public.${table}`);
  }
  if (!containsTableReference(rlsTestSql, table)) {
    failures.push(`rls_cross_tenant.sql does not reference public.${table}`);
  }
  if (!hasServiceOnlyRevoke(migrationSql, table)) {
    failures.push(`public.${table} is not explicitly revoked from anon/authenticated`);
  }
}

const unclassified = discoveredTables.filter((table) => !listedTables.has(table));
if (unclassified.length > 0) {
  // Platform / staff tables still require ENABLE+FORCE (checked above).
  // Call them out so new public tables are intentionally classified.
  console.log(
    `Unclassified public tables (ENABLE+FORCE only): ${unclassified.join(', ')}`,
  );
}

if (!/Tenant A cannot see Tenant B/i.test(rlsTestSql)) {
  failures.push('rls_cross_tenant.sql must include Tenant A cannot see Tenant B assertions');
}

if (!/Tenant B cannot see Tenant A/i.test(rlsTestSql)) {
  failures.push('rls_cross_tenant.sql must include Tenant B cannot see Tenant A assertions');
}

if (failures.length > 0) {
  throw new Error(
    `RLS coverage validation failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`,
  );
}

console.log(
  `Validated RLS coverage for ${discoveredTables.length} public table(s): ` +
    `${tenantTables.length} tenant, ${serviceOnlyTables.length} service-only, ` +
    `${unclassified.length} platform/other (ENABLE+FORCE).`,
);

function containsTableReference(sql, table) {
  return new RegExp(`\\bpublic\\.${table}\\b`, 'i').test(sql);
}

function hasMigrationClause(sql, table, clause) {
  return new RegExp(`alter\\s+table\\s+public\\.${table}\\s+${clause}`, 'i').test(sql);
}

function hasServiceOnlyRevoke(sql, table) {
  return new RegExp(
    `revoke\\s+all\\s+on\\s+(table\\s+)?public\\.${table}\\s+from\\s+(anon\\s*,\\s*authenticated|authenticated\\s*,\\s*anon)`,
    'i',
  ).test(sql);
}
