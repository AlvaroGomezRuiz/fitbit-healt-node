import "server-only";

import { parseFitbitFeatureFlagsFromEnv, type FitbitFeatureFlags as FitbitFeatureFlagsFromConfig } from "@/lib/fitbit/config";

/** Subconjunto expuesto a páginas que solo necesitan UI + estado de sync. */
export type FitbitFeatureFlags = Pick<FitbitFeatureFlagsFromConfig, "uiEnabled" | "syncEnabled">;

/**
 * Lee flags de Fitbit desde el entorno (misma fuente que ingest/telemetría en servidor).
 */
export function getFitbitFeatureFlags(env: NodeJS.ProcessEnv): FitbitFeatureFlags {
  const f = parseFitbitFeatureFlagsFromEnv(env);
  return { uiEnabled: f.uiEnabled, syncEnabled: f.syncEnabled };
}
