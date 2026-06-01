import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
const migrationNamePattern = /^(\d{14})_[a-z0-9_]+\.sql$/;

const entries = await readdir(migrationsDir, { withFileTypes: true });
const migrations = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
  .map((entry) => entry.name)
  .sort();

if (migrations.length === 0) {
  throw new Error('No Supabase migration files found.');
}

const seenTimestamps = new Set();
const failures = [];

for (const migration of migrations) {
  const match = migration.match(migrationNamePattern);

  if (!match) {
    failures.push(`${migration}: filename must match YYYYMMDDHHMMSS_snake_case.sql`);
    continue;
  }

  const [, timestamp] = match;
  if (seenTimestamps.has(timestamp)) {
    failures.push(`${migration}: duplicate timestamp ${timestamp}`);
  }
  seenTimestamps.add(timestamp);

  const content = await readFile(join(migrationsDir, migration), 'utf8');
  if (content.trim().length === 0) {
    failures.push(`${migration}: file is empty`);
  }
}

if (failures.length > 0) {
  throw new Error(`Migration validation failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
}

console.log(`Validated ${migrations.length} Supabase migration file(s).`);
