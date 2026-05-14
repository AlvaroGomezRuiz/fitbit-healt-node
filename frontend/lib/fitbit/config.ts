import { z } from "zod";

const truthyString = z.union([z.literal("true"), z.literal("1")]);

/**
 * Convierte variables de entorno opcionales en booleano estricto:
 * solo `"true"` o `"1"` activan; ausente u otro valor ⇒ false.
 */
function envFlagEnabled(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  const parsed = truthyString.safeParse(value.trim().toLowerCase());
  return parsed.success;
}

const fitbitEnvSchema = z.object({
  NEXT_PUBLIC_FITBIT_UI_ENABLED: z.string().optional(),
  FITBIT_INGEST_ENABLED: z.string().optional(),
  FITBIT_SYNC_ENABLED: z.string().optional(),
  /** Interruptor maestro de la pila Fitbit / Google Health en frontend. */
  FITBIT_ACTIVO: z.string().optional(),
});

function syncEnabledFromEnv(sync: string | undefined, legacy: string | undefined): boolean {
  if (sync !== undefined && sync.trim() !== "") {
    return envFlagEnabled(sync);
  }
  return envFlagEnabled(legacy);
}

/**
 * `FITBIT_ACTIVO`: solo `true` o `1` (tras trim y minúsculas) activan la pila;
 * ausente o cualquier otro valor ⇒ false (ahorro de tokens y sin consultas de telemetría).
 */
export function parseFitbitMasterFromEnv(env: Readonly<Record<string, string | undefined>>): boolean {
  return envFlagEnabled(env.FITBIT_ACTIVO);
}

export interface FitbitFeatureFlags {
  readonly uiEnabled: boolean;
  readonly ingestEnabled: boolean;
  /** Cron / webhooks / sync; con maestro apagado siempre false. */
  readonly syncEnabled: boolean;
}

/**
 * Lee flags Fitbit / telemetría desde `process.env` (solo invocar en servidor).
 * Si `FITBIT_ACTIVO` no es estrictamente activo, devuelve todo en false (anula granular).
 * Con maestro activo: `NEXT_PUBLIC_FITBIT_UI_ENABLED`, `FITBIT_INGEST_ENABLED`, y
 * `FITBIT_SYNC_ENABLED` (si no vacío) o, si `FITBIT_SYNC_ENABLED` está vacío, el mismo
 * criterio estricto sobre `FITBIT_ACTIVO` para sync.
 */
export function parseFitbitFeatureFlagsFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): FitbitFeatureFlags {
  if (!parseFitbitMasterFromEnv(env)) {
    return { uiEnabled: false, ingestEnabled: false, syncEnabled: false };
  }
  const parsed = fitbitEnvSchema.safeParse(env);
  if (!parsed.success) {
    return { uiEnabled: false, ingestEnabled: false, syncEnabled: false };
  }
  const row = parsed.data;
  return {
    uiEnabled: envFlagEnabled(row.NEXT_PUBLIC_FITBIT_UI_ENABLED),
    ingestEnabled: envFlagEnabled(row.FITBIT_INGEST_ENABLED),
    syncEnabled: syncEnabledFromEnv(row.FITBIT_SYNC_ENABLED, row.FITBIT_ACTIVO),
  };
}
