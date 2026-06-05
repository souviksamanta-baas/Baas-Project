import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
const rlsTestPath = join(process.cwd(), 'supabase', 'tests', 'rls_cross_tenant.sql');

const tenantTables = [
  'organizations',
  'organization_members',
  'contacts',
  'conversations',
  'conversation_messages',
  'products',
  'owner_tasks',
  'owner_notifications',
  'owner_device_tokens',
  'ai_drafts',
  'ai_draft_events',
];

const serviceOnlyTables = ['whatsapp_config', 'whatsapp_message_events'];
const expectedTables = [...tenantTables, ...serviceOnlyTables];
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

for (const table of expectedTables) {
  if (!containsTableReference(rlsTestSql, table)) {
    failures.push(`rls_cross_tenant.sql does not reference public.${table}`);
  }
}

for (const table of tenantTables) {
  if (!hasMigrationClause(migrationSql, table, 'enable row level security')) {
    failures.push(`public.${table} does not enable row level security in migrations`);
  }

  if (!hasMigrationClause(migrationSql, table, 'force row level security')) {
    failures.push(`public.${table} does not force row level security in migrations`);
  }
}

for (const table of serviceOnlyTables) {
  if (!hasMigrationClause(migrationSql, table, 'enable row level security')) {
    failures.push(`public.${table} does not enable row level security in migrations`);
  }

  if (!hasMigrationClause(migrationSql, table, 'force row level security')) {
    failures.push(`public.${table} does not force row level security in migrations`);
  }

  if (!hasServiceOnlyRevoke(migrationSql, table)) {
    failures.push(`public.${table} is not explicitly revoked from anon/authenticated`);
  }
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
  `Validated RLS coverage for ${tenantTables.length} tenant table(s) and ${serviceOnlyTables.length} service-only table(s).`,
);

function containsTableReference(sql, table) {
  return new RegExp(`\\bpublic\\.${table}\\b`, 'i').test(sql);
}

function hasMigrationClause(sql, table, clause) {
  return new RegExp(`alter\\s+table\\s+public\\.${table}\\s+${clause}`, 'i').test(sql);
}

function hasServiceOnlyRevoke(sql, table) {
  return new RegExp(
    `revoke\\s+all\\s+on\\s+public\\.${table}\\s+from\\s+anon\\s*,\\s*authenticated`,
    'i',
  ).test(sql);
}
