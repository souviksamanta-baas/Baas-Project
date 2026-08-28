import { defineRailway, github, preserve, project, service } from "railway/iac";

/**
 * Owns only the maintenance cron. Baas-Project and nexolia-web stay
 * dashboard-managed (Baas-Project still uses legacy railway.json until Dec 2026).
 */
export const partial = "maintenance";

export default defineRailway(() => {
  const baasMaintenanceCron = service("baas-maintenance-cron", {
    source: github("souviksamanta-baas/Baas-Project", { checkSuites: false }),
    build: "node -e \"console.log('baas-maintenance-cron ready')\"",
    start: "node scripts/run-maintenance-job.mjs",
    deploy: {
      cronSchedule: "*/10 * * * *",
      restartPolicyType: "NEVER",
    },
    replicas: { sfo: 1 },
    env: {
      API_BASE_URL: "https://baas-project-production.up.railway.app",
      // Keep the value already set on Railway (prefer a variable reference
      // from Baas-Project in the dashboard if you recreate this service).
      BAAS_TASKS_JOB_SECRET: preserve(),
    },
  });

  return project("BaaS Project", {
    resources: [baasMaintenanceCron],
  });
});
