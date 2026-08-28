#!/usr/bin/env node
/**
 * Railway cron entrypoint: POST /tasks/run-maintenance then exit.
 *
 * Required env:
 * - API_BASE_URL (e.g. https://baas-project-production.up.railway.app)
 *   or RAILWAY_SERVICE_BAAS_PROJECT_URL (auto-injected private/public service URL)
 * - BAAS_TASKS_JOB_SECRET (same value as the API service)
 */

const apiBaseUrl = (
  process.env.API_BASE_URL ||
  process.env.RAILWAY_SERVICE_BAAS_PROJECT_URL ||
  ''
).replace(/\/$/, '');
const secret = process.env.BAAS_TASKS_JOB_SECRET;

if (!apiBaseUrl) {
  console.error(
    'API_BASE_URL (or RAILWAY_SERVICE_BAAS_PROJECT_URL) is required for the maintenance cron job.',
  );
  process.exit(1);
}

if (!secret) {
  console.error('BAAS_TASKS_JOB_SECRET is required for the maintenance cron job.');
  process.exit(1);
}

const url = `${apiBaseUrl}/tasks/run-maintenance`;
console.log(`Calling ${url}`);

const response = await fetch(url, {
  headers: {
    'content-type': 'application/json',
    'x-baas-job-secret': secret,
  },
  method: 'POST',
});

const bodyText = await response.text();
let parsed;
try {
  parsed = JSON.parse(bodyText);
} catch {
  parsed = bodyText;
}

if (!response.ok) {
  console.error('Maintenance job failed', response.status, parsed);
  process.exit(1);
}

console.log('Maintenance job ok', JSON.stringify(parsed));
process.exit(0);
