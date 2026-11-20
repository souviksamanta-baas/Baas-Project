// Fails when a migration file in supabase/migrations has not been applied to the
// hosted Supabase project (or the other way round).
//
// Why compare by name and not by version: migrations applied through the
// Supabase dashboard/MCP are recorded with the time they were applied, so the
// version (timestamp) differs from the file name. The migration name is stable.
//
// Usage:
//   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... node scripts/check-migration-drift.mjs
//   node scripts/check-migration-drift.mjs --from-json applied.json   # offline / tests
//
// Migrations that are applied remotely under a different name are listed in
// supabase/migration-drift-ignore.json.
//     (applied.json: [{ "version": "2026...", "name": "create_x" }, ...])

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
const filePattern = /^(\d{14})_([a-z0-9_]+)\.sql$/;
// Some remote rows were recorded with the file timestamp inside the name.
const normalizeName = (name) => String(name).replace(/^\d{14}_/, '');

async function loadApplied() {
  const flagIndex = process.argv.indexOf('--from-json');
  if (flagIndex !== -1) {
    const path = process.argv[flagIndex + 1];
    if (!path) throw new Error('--from-json needs a file path.');
    return JSON.parse(await readFile(path, 'utf8'));
  }

  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!token || !ref) {
    throw new Error('Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF (or use --from-json).');
  }

  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    body: JSON.stringify({
      query: 'select version, name from supabase_migrations.schema_migrations order by version',
    }),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Supabase Management API returned ${response.status} ${response.statusText}.`);
  }
  return response.json();
}

const files = (await readdir(migrationsDir))
  .map((file) => file.match(filePattern))
  .filter(Boolean)
  .map(([file, version, name]) => ({ file, name, version }));

const applied = await loadApplied();
if (!Array.isArray(applied) || applied.length === 0) {
  throw new Error('No applied migrations returned; refusing to compare against an empty list.');
}
const appliedNames = new Set(applied.map((row) => normalizeName(row.name)));
const fileNames = new Set(files.map((entry) => entry.name));

const ignorePath = join(process.cwd(), 'supabase', 'migration-drift-ignore.json');
const ignored = new Set(
  JSON.parse(await readFile(ignorePath, 'utf8').catch(() => '{}')).applied_under_other_name?.map(
    (entry) => entry.name,
  ) ?? [],
);

const notApplied = files.filter((entry) => !appliedNames.has(entry.name) && !ignored.has(entry.name));
const notInRepo = applied.filter((row) => !fileNames.has(normalizeName(row.name)));

if (notInRepo.length > 0) {
  console.warn(
    `Warning: ${notInRepo.length} remote migration(s) have no file in the repo: ${notInRepo
      .map((row) => row.name)
      .join(', ')}`,
  );
}

if (notApplied.length > 0) {
  console.error(
    `Migration drift: ${notApplied.length} migration file(s) are not applied to the hosted project:\n${notApplied
      .map((entry) => `- ${entry.file}`)
      .join('\n')}`,
  );
  process.exit(1);
}

console.log(`No migration drift: ${files.length} repo migration(s) are all applied remotely.`);
